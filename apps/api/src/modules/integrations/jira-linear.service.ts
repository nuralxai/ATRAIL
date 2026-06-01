import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { encrypt, decrypt } from "../../utils/encrypt.js";

/* ─── Jira ───────────────────────────────────────────────────────── */

export const jiraService = {
  async connect(userId: string, data: { baseUrl: string; email: string; apiKey: string }) {
    const base = data.baseUrl.replace(/\/$/, "");

    // Verify credentials by hitting /myself
    const test = await fetch(`${base}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${data.email}:${data.apiKey}`).toString("base64")}`,
        Accept: "application/json",
      },
    });
    if (!test.ok) throw new ApiError(401, "Invalid Jira credentials. Check email, API key and base URL.");
    const me = await test.json() as any;

    await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId, provider: "JIRA" } },
      update: {
        accessToken:    encrypt(data.apiKey),
        email:          data.email,
        providerUserId: base,          // we store base URL here
        scope:          me.accountId ?? "",
      },
      create: {
        userId,
        provider:       "JIRA",
        accessToken:    encrypt(data.apiKey),
        email:          data.email,
        providerUserId: base,
        scope:          me.accountId ?? "",
      },
    });
    return { accountId: me.accountId, displayName: me.displayName };
  },

  async _creds(userId: string) {
    const acc = await prisma.connectedAccount.findUnique({
      where: { userId_provider: { userId, provider: "JIRA" } },
    });
    if (!acc) throw new ApiError(400, "Jira not connected. Connect it first in Integrations.");
    return {
      base:    acc.providerUserId!,          // base URL
      auth:    Buffer.from(`${acc.email}:${decrypt(acc.accessToken)}`).toString("base64"),
    };
  },

  async _get(userId: string, path: string) {
    const { base, auth } = await this._creds(userId);
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, `Jira API error: ${err}`);
    }
    return res.json();
  },

  async getMyIssues(userId: string) {
    const data = await this._get(userId,
      `/rest/api/3/search?jql=assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC&maxResults=50&fields=summary,status,priority,project,duedate,issuetype`
    ) as any;
    return (data.issues ?? []).map((i: any) => ({
      id:       i.id,
      key:      i.key,
      summary:  i.fields.summary,
      status:   i.fields.status?.name,
      priority: i.fields.priority?.name,
      project:  i.fields.project?.name,
      duedate:  i.fields.duedate,
      type:     i.fields.issuetype?.name,
    }));
  },

  async getProjects(userId: string) {
    const data = await this._get(userId,
      `/rest/api/3/project/search?maxResults=50&orderBy=lastIssueUpdatedTime`
    ) as any;
    return (data.values ?? []).map((p: any) => ({
      id:   p.id,
      key:  p.key,
      name: p.name,
      type: p.projectTypeKey,
      lead: p.lead?.displayName,
    }));
  },

  async createIssue(userId: string, data: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType?: string;
    priority?: string;
  }) {
    const { base, auth } = await this._creds(userId);
    const body = {
      fields: {
        project:     { key: data.projectKey },
        summary:     data.summary,
        issuetype:   { name: data.issueType ?? "Task" },
        priority:    data.priority ? { name: data.priority } : undefined,
        description: data.description ? {
          type: "doc", version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: data.description }] }],
        } : undefined,
      },
    };
    const res = await fetch(`${base}/rest/api/3/issue`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ApiError(res.status, `Jira create error: ${err}`);
    }
    return res.json();
  },
};

/* ─── Linear ──────────────────────────────────────────────────────── */

const LINEAR_GQL = "https://api.linear.app/graphql";

async function linearQuery(apiKey: string, query: string, variables?: object) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new ApiError(res.status, `Linear API error: ${res.statusText}`);
  const json = await res.json() as any;
  if (json.errors?.length) throw new ApiError(400, json.errors[0].message);
  return json.data;
}

export const linearService = {
  async connect(userId: string, apiKey: string) {
    const data = await linearQuery(apiKey, `{ viewer { id name email organization { name } } }`);
    const viewer = data.viewer;

    await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId, provider: "LINEAR" } },
      update: {
        accessToken:    encrypt(apiKey),
        email:          viewer.email,
        providerUserId: viewer.id,
        scope:          viewer.organization?.name ?? "",
      },
      create: {
        userId,
        provider:       "LINEAR",
        accessToken:    encrypt(apiKey),
        email:          viewer.email,
        providerUserId: viewer.id,
        scope:          viewer.organization?.name ?? "",
      },
    });
    return { id: viewer.id, name: viewer.name, org: viewer.organization?.name };
  },

  async _key(userId: string): Promise<string> {
    const acc = await prisma.connectedAccount.findUnique({
      where: { userId_provider: { userId, provider: "LINEAR" } },
    });
    if (!acc) throw new ApiError(400, "Linear not connected. Connect it first in Integrations.");
    return decrypt(acc.accessToken);
  },

  async getMyIssues(userId: string) {
    const key = await this._key(userId);
    const data = await linearQuery(key, `{
      viewer {
        assignedIssues(filter: { completedAt: { null: true } }, first: 50) {
          nodes {
            id identifier title
            state { name color }
            priority
            dueDate
            team { name }
            project { name }
            createdAt updatedAt
          }
        }
      }
    }`);
    return (data.viewer.assignedIssues.nodes ?? []).map((i: any) => ({
      id:       i.id,
      key:      i.identifier,
      title:    i.title,
      status:   i.state?.name,
      color:    i.state?.color,
      priority: ["No priority","Urgent","High","Medium","Low"][i.priority] ?? "No priority",
      team:     i.team?.name,
      project:  i.project?.name,
      dueDate:  i.dueDate,
    }));
  },

  async getTeams(userId: string) {
    const key = await this._key(userId);
    const data = await linearQuery(key, `{
      teams { nodes { id name key description } }
    }`);
    return data.teams.nodes ?? [];
  },

  async createIssue(userId: string, data: {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
  }) {
    const key = await this._key(userId);
    const result = await linearQuery(key, `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id identifier title } }
      }
    `, {
      input: {
        teamId:      data.teamId,
        title:       data.title,
        description: data.description,
        priority:    data.priority ?? 0,
      },
    });
    return result.issueCreate.issue;
  },
};
