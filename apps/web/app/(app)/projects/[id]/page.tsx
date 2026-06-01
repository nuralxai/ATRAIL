"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { API_HOST } from "@/lib/config";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";

type Project = {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  organization?: { id: string; name: string };
  headId: string | null;
  head: { id: string; fullName: string; role: string } | null;
  assignedAdminId?: string | null;
  assignedAdmin?: { id: string; fullName: string } | null;
  assignedEliteId?: string | null;
  assignedElite?: { id: string; fullName: string } | null;
  progress?: number;
};

type MemberRow = {
  role: "HEAD" | "MEMBER";
  joinedAt: string;
  user: { id: string; fullName: string; email: string; role: string };
};

type TaskRow = {
  id: string;
  title: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  dueAt: string | null;
  assignedTo: { id: string; fullName: string; role: string };
  assignedBy: { id: string; fullName: string; role: string };
  submissions: Array<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    createdAt: string;
    notes: string | null;
    proofs: Array<{ id: string; fileUrl: string; fileName: string }>;
  }>;
};

type UserLite = { id: string; fullName: string; email: string; role: string };

function taskTone(s: TaskRow["status"]) {
  if (s === "ACCEPTED") return "green";
  if (s === "SUBMITTED") return "blue";
  if (s === "IN_PROGRESS") return "amber";
  if (s === "REJECTED") return "red";
  return "neutral";
}

function subTone(s: "PENDING" | "ACCEPTED" | "REJECTED") {
  if (s === "ACCEPTED") return "green";
  if (s === "REJECTED") return "red";
  return "blue";
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Handle both sync and async params (Next.js 15+ uses async params)
  const projectId = params instanceof Promise ? undefined : params.id;

  // For async params, we'll handle in useEffect
  const [resolvedProjectId, setResolvedProjectId] = useState<
    string | undefined
  >(projectId);

  useEffect(() => {
    if (params instanceof Promise) {
      params.then((p) => setResolvedProjectId(p.id));
    }
  }, [params]);

  const finalProjectId = resolvedProjectId || projectId;
  const { user } = useAuthStore();
  const router = useRouter();

  // Keep permissions logic internal (do not show in UI)
  const isAdminPlus = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [tab, setTab] = useState<"overview" | "members" | "tasks">("overview");

  // Assign task modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueAt, setDueAt] = useState("");

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    submissionId: string;
    taskTitle: string;
  } | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  // Member management modals
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserLite[]>([]);
  const [changeHeadOpen, setChangeHeadOpen] = useState(false);
  const [newHeadId, setNewHeadId] = useState("");

  const [transferOpen, setTransferOpen] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState("");
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([]);

  const load = async () => {
    if (!finalProjectId) return;
    setErr(null);
    setLoading(true);
    try {
      const p = await authedFetch<{ ok: true; project: Project }>(
        `/projects/${finalProjectId}`
      );
      const m = await authedFetch<{ ok: true; members: MemberRow[] }>(
        `/projects/${finalProjectId}/members`
      );
      const t = await authedFetch<{ ok: true; tasks: TaskRow[] }>(
        `/tasks/project/${finalProjectId}`
      );

      setProject(p.project);
      setMembers(m.members ?? []);
      setTasks(t.tasks ?? []);

      if (isAdminPlus && user?.role === "SUPER_ADMIN") {
        const orgsRes = await authedFetch<{ ok: true; organizations: {id: string, name: string}[] }>("/organizations");
        setOrganizations(orgsRes.organizations ?? []);
      }

      // sensible default assignee: first USER if none set
      if (!assignedToId) {
        const firstUser = (m.members ?? []).find((x) => x.user.role === "USER")
          ?.user.id;
        if (firstUser) setAssignedToId(firstUser);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load project";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (finalProjectId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalProjectId]);

  // Load available users for adding members (ADMIN/SUPER_ADMIN only)
  const loadAvailableUsers = async () => {
    if (!isAdminPlus) return;
    try {
      const res = await authedFetch<{ ok: true; users: UserLite[] }>("/users");
      // Filter to only ELITE and USER (as per rules)
      const eligible = (res.users ?? []).filter(
        (u) => u.role === "ELITE" || u.role === "USER"
      );
      // Exclude current members
      const memberIds = new Set(members.map((m) => m.user.id));
      setAvailableUsers(eligible.filter((u) => !memberIds.has(u.id)));
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (addMemberOpen && isAdminPlus) {
      loadAvailableUsers();
    }
  }, [addMemberOpen, isAdminPlus, members]);

  // Load ELITE users for changing head or assigning elite
  const [eliteUsers, setEliteUsers] = useState<UserLite[]>([]);
  const loadEliteUsers = async () => {
    if (!isAdminPlus) return;
    try {
      const res = await authedFetch<{ ok: true; users: UserLite[] }>("/users");
      setEliteUsers((res.users ?? []).filter((u) => u.role === "ELITE"));
    } catch (e) {
      // ignore
    }
  };

  const [assignEliteOpen, setAssignEliteOpen] = useState(false);
  const [newEliteId, setNewEliteId] = useState("");

  useEffect(() => {
    if ((changeHeadOpen || assignEliteOpen) && isAdminPlus) {
      loadEliteUsers();
    }
  }, [changeHeadOpen, assignEliteOpen, isAdminPlus]);

  const [assignAdminOpen, setAssignAdminOpen] = useState(false);
  const [newAdminId, setNewAdminId] = useState("");
  const [adminUsers, setAdminUsers] = useState<UserLite[]>([]);

  const loadAdminUsers = async () => {
    if (user?.role !== "SUPER_ADMIN") return;
    try {
      const res = await authedFetch<{ ok: true; users: UserLite[] }>("/users");
      setAdminUsers((res.users ?? []).filter((u) => u.role === "ADMIN"));
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (assignAdminOpen && user?.role === "SUPER_ADMIN") {
      loadAdminUsers();
    }
  }, [assignAdminOpen, user]);


  useEffect(() => {
    if (changeHeadOpen && isAdminPlus) {
      loadEliteUsers();
    }
  }, [changeHeadOpen, isAdminPlus]);

  const isHead = useMemo(() => {
    return !!(
      user?.role === "ELITE" &&
      project?.headId &&
      project.headId === user.id
    );
  }, [user, project]);

  const canAssign = isAdminPlus || isHead;

  const assigneeOptions = useMemo(() => {
    const mem = members.map((m) => m.user);
    if (isHead) return mem.filter((u) => u.role === "USER");
    return mem;
  }, [members, isHead]);

  const createTask = async () => {
    if (!canAssign) return;

    const t = title.trim();
    const d = desc.trim();
    if (t.length < 2) return toast.error("Task title is too short");
    if (!assignedToId) return toast.error("Pick an assignee");

    const ok = await confirm({
      title: "Create task?",
      message: "This will create a task and notify the assignee.",
      confirmText: "Create",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: finalProjectId,
          title: t,
          description: d ? d : undefined,
          assignedToId,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });

      setAssignOpen(false);
      setTitle("");
      setDesc("");
      setDueAt("");

      toast.success("Task created");
      await load();
      setTab("tasks");
    } catch (e: any) {
      toast.error(e?.message || "Create task failed");
    } finally {
      setBusy(false);
    }
  };

  const openReview = (submissionId: string, taskTitle: string) => {
    setReviewTarget({ submissionId, taskTitle });
    setReviewComment("");
    setReviewOpen(true);
  };

  const review = async (decision: "ACCEPT" | "REJECT") => {
    if (!reviewTarget) return;

    const ok = await confirm({
      title:
        decision === "ACCEPT" ? "Approve submission?" : "Reject submission?",
      message:
        decision === "ACCEPT"
          ? "This marks the submission as approved."
          : "This will ask for changes. You can add a comment.",
      confirmText: decision === "ACCEPT" ? "Approve" : "Reject",
      danger: decision === "REJECT",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(
        `/tasks/submissions/${reviewTarget.submissionId}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            comment: reviewComment.trim() ? reviewComment.trim() : undefined,
          }),
        }
      );

      setReviewOpen(false);
      setReviewTarget(null);

      toast.success(decision === "ACCEPT" ? "Approved" : "Rejected");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Review failed");
    } finally {
      setBusy(false);
    }
  };

  const latestSubmission = (t: TaskRow) => t.submissions?.[0] ?? null;

  // Add members
  const handleAddMembers = async () => {
    if (!isAdminPlus || !finalProjectId || selectedUserIds.length === 0) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      setAddMemberOpen(false);
      setSelectedUserIds([]);
      toast.success("Members added");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add members");
    } finally {
      setBusy(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!isAdminPlus || !finalProjectId) return;

    const ok = await confirm({
      title: "Remove member?",
      message: `This will remove ${userName} from the project.`,
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}/members/${userId}`, {
        method: "DELETE",
      });
      toast.success("Member removed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  // Assign Admin
  const handleAssignAdmin = async () => {
    if (user?.role !== "SUPER_ADMIN" || !finalProjectId || !newAdminId) return;

    const ok = await confirm({
      title: "Assign Admin?",
      message: "This will assign the selected ADMIN to oversee this project.",
      confirmText: "Assign",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      // Must import assignProjectAdmin in the file or just use authedFetch directly
      await authedFetch(`/projects/${finalProjectId}/assign-admin`, {
        method: "POST",
        body: JSON.stringify({ adminId: newAdminId })
      });
      toast.success("Admin assigned successfully");
      setAssignAdminOpen(false);
      setNewAdminId("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign admin");
    } finally {
      setBusy(false);
    }
  };

  // Assign Elite
  const handleAssignElite = async () => {
    if (!isAdminPlus || !finalProjectId || !newEliteId) return;

    const ok = await confirm({
      title: "Assign Elite?",
      message: "This will assign the selected ELITE to oversee this project.",
      confirmText: "Assign",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}/assign-elite`, {
        method: "POST",
        body: JSON.stringify({ eliteId: newEliteId })
      });
      toast.success("Elite assigned successfully");
      setAssignEliteOpen(false);
      setNewEliteId("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign elite");
    } finally {
      setBusy(false);
    }
  };

  // Change/Assign head
  const handleChangeHead = async () => {
    if (!isAdminPlus || !finalProjectId || !newHeadId) return;

    const isChanging = !!project?.headId;
    const ok = await confirm({
      title: isChanging ? "Change project lead?" : "Assign project lead?",
      message: isChanging
        ? "This will replace the current project lead."
        : "This will assign a project lead.",
      confirmText: isChanging ? "Change" : "Assign",
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}/head`, {
        method: "POST",
        body: JSON.stringify({ headId: newHeadId }),
      });
      setChangeHeadOpen(false);
      setNewHeadId("");
      toast.success(
        isChanging ? "Project lead changed" : "Project lead assigned"
      );
      await load();
      // Reload elite users for next time
      await loadEliteUsers();
    } catch (e: any) {
      toast.error(
        e?.message ||
          (isChanging ? "Failed to change lead" : "Failed to assign lead")
      );
    } finally {
      setBusy(false);
    }
  };

  // Delete project
  const handleDeleteProject = async () => {
    if (!isAdminPlus || !finalProjectId) return;

    const ok = await confirm({
      title: "Delete project?",
      message:
        "This will permanently delete the project and all its data. This action cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}`, {
        method: "DELETE",
      });
      toast.success("Project deleted");
      // Redirect to projects list
      window.location.href = "/projects";
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete project");
    } finally {
      setBusy(false);
    }
  };

  // Transfer project
  const handleTransferProject = async () => {
    if (!isAdminPlus || user?.role !== "SUPER_ADMIN" || !finalProjectId || !targetOrgId) return;

    const ok = await confirm({
      title: "Transfer project?",
      message: "This will move the project and all its tasks, chat, and members to the new tenant. Are you sure?",
      confirmText: "Transfer",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}`, {
        method: "PUT",
        body: JSON.stringify({ organizationId: targetOrgId }),
      });
      setTransferOpen(false);
      setTargetOrgId("");
      toast.success("Project transferred successfully");
      await load(); // Reload to see new org badge
    } catch (e: any) {
      toast.error(e?.message || "Failed to transfer project");
    } finally {
      setBusy(false);
    }
  };

  // Unset head
  const handleUnsetHead = async () => {
    if (!isAdminPlus || !finalProjectId || !project?.headId) return;

    const ok = await confirm({
      title: "Remove project lead?",
      message: "This will unset the current project lead.",
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setErr(null);
    try {
      await authedFetch(`/projects/${finalProjectId}/head`, {
        method: "POST",
        body: JSON.stringify({ headId: null }),
      });
      toast.success("Project lead removed");
      await load();
      // Reload elite users so they can be reassigned
      await loadEliteUsers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove lead");
    } finally {
      setBusy(false);
    }
  };

  const openProjectChat = async () => {
    if (!finalProjectId) return;
    setBusy(true);
    try {
      const res = await authedFetch<{ ok: true; conversation: { id: string } }>(
        "/chat/project",
        {
          method: "POST",
          body: JSON.stringify({ projectId: finalProjectId }),
        }
      );
      router.push(`/chat?selected=${res.conversation.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to open chat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title={project ? project.name : "Project"}
      subtitle={
        project ? "Members, tasks, and submissions in one place." : "Loading…"
      }
      right={
        <div className="flex items-center gap-2">
          <Button
            onClick={openProjectChat}
            disabled={busy || loading || !finalProjectId}
          >
            Project Chat
          </Button>
          {canAssign && (
            <Button
              onClick={() => setAssignOpen(true)}
              disabled={busy || loading}
            >
              New Task
            </Button>
          )}
          {isAdminPlus && (
            <Button
              variant="secondary"
              onClick={handleDeleteProject}
              disabled={busy || loading}
            >
              Delete Project
            </Button>
          )}
          {isAdminPlus && user?.role === "SUPER_ADMIN" && (
            <Button
              variant="secondary"
              onClick={() => setTransferOpen(true)}
              disabled={busy || loading}
            >
              Transfer Project
            </Button>
          )}
          <Button variant="secondary" onClick={load} disabled={busy || loading}>
            Refresh
          </Button>
        </div>
      }
    >
      {err && <div className="mb-4 text-sm text-red-600">{err}</div>}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-60" />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader
              title="Overview"
              subtitle={project?.description ?? "No description added yet."}
              right={
                <div className="flex items-center gap-2">
                  {user?.role === "SUPER_ADMIN" && project?.organization && (
                    <Badge tone="blue">{project.organization.name}</Badge>
                  )}
                  {user?.role === "SUPER_ADMIN" && (
                    <Button variant="secondary" onClick={() => setAssignAdminOpen(true)} className="text-xs px-2 py-1 h-auto" disabled={busy}>Assign Admin</Button>
                  )}
                  {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
                    <Button variant="secondary" onClick={() => setAssignEliteOpen(true)} className="text-xs px-2 py-1 h-auto" disabled={busy}>Assign Elite</Button>
                  )}
                  <Badge tone="neutral">
                    Lead: {project?.head ? project.head.fullName : "Not assigned"}
                  </Badge>
                </div>
              }
            />
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["overview", "members", "tasks"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={
                      "rounded-xl px-3 py-2 text-xs font-semibold border transition " +
                      (tab === t
                        ? "glass-panel text-white border-zinc-900"
                        : "glass-panel text-text-main border-primary/20 glass-panel hover:glass-panel")
                    }
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              {tab === "overview" && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-text-muted">Members</div>
                      <div className="text-lg font-semibold mt-1">
                        {members.length}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-text-muted">Tasks</div>
                      <div className="text-lg font-semibold mt-1">
                        {tasks.length}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-text-muted font-medium">Progress</span>
                        <span className="text-primary font-bold">{project?.progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 mt-2">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${project?.progress ?? 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 glass-panel p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-text-muted">Last updated</div>
                      <div className="text-sm font-semibold mt-1">
                        {new Date().toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {tab === "members" && (
            <>
              <Card className="mb-4">
                <CardHeader
                  title="Members"
                  subtitle="People in this project"
                  right={
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{members.length}</Badge>
                      {isAdminPlus && (
                        <Button
                          variant="secondary"
                          onClick={() => setAddMemberOpen(true)}
                          disabled={busy}
                        >
                          Add Members
                        </Button>
                      )}
                      {isAdminPlus && !project?.headId && (
                        <Button
                          variant="secondary"
                          onClick={() => setChangeHeadOpen(true)}
                          disabled={busy}
                        >
                          Assign Lead
                        </Button>
                      )}
                      {isAdminPlus && project?.headId && (
                        <Button
                          variant="secondary"
                          onClick={() => setChangeHeadOpen(true)}
                          disabled={busy}
                        >
                          Change Lead
                        </Button>
                      )}
                      {isAdminPlus && project?.headId && (
                        <Button
                          variant="secondary"
                          onClick={handleUnsetHead}
                          disabled={busy}
                        >
                          Remove Lead
                        </Button>
                      )}
                    </div>
                  }
                />
                <CardContent>
                  {members.length === 0 ? (
                    <div className="text-sm text-text-muted">No members yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map((m) => (
                        <div
                          key={m.user.id}
                          className="rounded-2xl border border-primary/20 glass-panel p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="text-sm font-semibold">
                                {m.user.fullName}
                              </div>
                              <div className="text-xs text-text-muted mt-1">
                                {m.user.email}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                tone={m.role === "HEAD" ? "blue" : "neutral"}
                              >
                                {m.role === "HEAD" ? "LEAD" : "MEMBER"}
                              </Badge>
                              {isAdminPlus && (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    handleRemoveMember(
                                      m.user.id,
                                      m.user.fullName
                                    )
                                  }
                                  disabled={busy}
                                  className="text-xs px-2 py-1"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-text-muted mt-3">
                            Joined: {new Date(m.joinedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Members Modal */}
              <Modal
                open={addMemberOpen}
                title="Add Members"
                subtitle="Select ELITE or USER to add to the project"
                onClose={() => (!busy ? setAddMemberOpen(false) : null)}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAddMemberOpen(false);
                        setSelectedUserIds([]);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddMembers}
                      disabled={busy || selectedUserIds.length === 0}
                    >
                      Add{" "}
                      {selectedUserIds.length > 0
                        ? `(${selectedUserIds.length})`
                        : ""}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <div className="text-sm text-text-muted">
                      No eligible users available to add.
                    </div>
                  ) : (
                    availableUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 glass-panel hover:glass-panel cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, u.id]);
                            } else {
                              setSelectedUserIds(
                                selectedUserIds.filter((id) => id !== u.id)
                              );
                            }
                          }}
                          className="rounded border-primary/20"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">
                            {u.fullName}
                          </div>
                          <div className="text-xs text-text-muted">{u.email}</div>
                        </div>
                        <Badge tone="neutral">{u.role}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </Modal>

              {/* Change/Assign Head Modal */}
              <Modal
                open={changeHeadOpen}
                title={
                  project?.headId
                    ? "Change Project Lead"
                    : "Assign Project Lead"
                }
                subtitle="Select an ELITE user as the project lead"
                onClose={() => (!busy ? setChangeHeadOpen(false) : null)}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setChangeHeadOpen(false);
                        setNewHeadId("");
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleChangeHead}
                      disabled={busy || !newHeadId}
                    >
                      {project?.headId ? "Change Lead" : "Assign Lead"}
                    </Button>
                  </div>
                }
              >
                <div className="space-y-2">
                  <select
                    value={newHeadId}
                    onChange={(e) => setNewHeadId(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select ELITE user...</option>
                    {eliteUsers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} • {e.email}
                      </option>
                    ))}
                  </select>
                  {project?.headId && (
                    <div className="text-xs text-text-muted mt-2">
                      Current lead: {project.head?.fullName}
                    </div>
                  )}
                  {!project?.headId && (
                    <div className="text-xs text-text-muted mt-2">
                      No lead assigned yet. Select an ELITE user to assign as
                      lead.
                    </div>
                  )}
                </div>
              </Modal>

              {/* Transfer Project Modal */}
              <Modal
                open={transferOpen}
                title="Transfer Project"
                subtitle="Move this project to a different tenant/organization."
                onClose={() => (!busy ? setTransferOpen(false) : null)}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTransferOpen(false);
                        setTargetOrgId("");
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleTransferProject}
                      disabled={busy || !targetOrgId}
                    >
                      Transfer
                    </Button>
                  </div>
                }
              >
                <div className="space-y-2">
                  <select
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select Target Tenant...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  {project?.organization && (
                    <div className="text-xs text-text-muted mt-2">
                      Current tenant: {project.organization.name}
                    </div>
                  )}
                </div>
              </Modal>

              {/* Assign Admin Modal */}
              <Modal
                open={assignAdminOpen}
                title="Assign Admin"
                subtitle="Select an ADMIN user to oversee this project"
                onClose={() => (!busy ? setAssignAdminOpen(false) : null)}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => { setAssignAdminOpen(false); setNewAdminId(""); }} disabled={busy}>Cancel</Button>
                    <Button onClick={handleAssignAdmin} disabled={busy || !newAdminId}>Assign</Button>
                  </div>
                }
              >
                <div className="space-y-2">
                  <select
                    value={newAdminId}
                    onChange={(e) => setNewAdminId(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select ADMIN user...</option>
                    {adminUsers.map((a) => (
                      <option key={a.id} value={a.id}>{a.fullName} • {a.email}</option>
                    ))}
                  </select>
                  {project?.assignedAdmin && (
                    <div className="text-xs text-text-muted mt-2">Currently Assigned Admin: {project.assignedAdmin.fullName}</div>
                  )}
                </div>
              </Modal>

              {/* Assign Elite Modal */}
              <Modal
                open={assignEliteOpen}
                title="Assign Elite"
                subtitle="Select an ELITE user to oversee this project"
                onClose={() => (!busy ? setAssignEliteOpen(false) : null)}
                footer={
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => { setAssignEliteOpen(false); setNewEliteId(""); }} disabled={busy}>Cancel</Button>
                    <Button onClick={handleAssignElite} disabled={busy || !newEliteId}>Assign</Button>
                  </div>
                }
              >
                <div className="space-y-2">
                  <select
                    value={newEliteId}
                    onChange={(e) => setNewEliteId(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Select ELITE user...</option>
                    {eliteUsers.map((e) => (
                      <option key={e.id} value={e.id}>{e.fullName} • {e.email}</option>
                    ))}
                  </select>
                  {project?.assignedElite && (
                    <div className="text-xs text-text-muted mt-2">Currently Assigned Elite: {project.assignedElite.fullName}</div>
                  )}
                </div>
              </Modal>
            </>
          )}

          {tab === "tasks" && (
            <Card>
              <CardHeader
                title="Tasks"
                subtitle="Track progress and review submissions"
                right={<Badge tone="neutral">{tasks.length}</Badge>}
              />
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-sm text-text-muted">No tasks yet.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((t) => {
                      const sub = latestSubmission(t);
                      const canReview = !!sub && sub.status === "PENDING";

                      return (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-primary/20 glass-panel p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-primary">
                                {t.title}
                              </div>
                              <div className="text-xs text-text-muted mt-1">
                                Assigned to {t.assignedTo.fullName} • by{" "}
                                {t.assignedBy.fullName}
                                {t.dueAt
                                  ? ` • Due ${new Date(t.dueAt).toLocaleString()}`
                                  : ""}
                              </div>
                            </div>

                            <Badge tone={taskTone(t.status) as any}>
                              {t.status.replace("_", " ")}
                            </Badge>
                          </div>

                          {sub && (
                            <div className="mt-3 rounded-2xl border border-primary/20 glass-panel p-4 glass-panel">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">
                                    Latest submission •{" "}
                                    {new Date(sub.createdAt).toLocaleString()}
                                  </div>
                                  {sub.notes && (
                                    <div className="text-sm text-text-main mt-2 whitespace-pre-wrap">
                                      {sub.notes}
                                    </div>
                                  )}
                                </div>

                                <Badge tone={subTone(sub.status) as any}>
                                  {sub.status}
                                </Badge>
                              </div>

                              {sub.proofs?.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs text-text-muted mb-2">
                                    Proof files
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {sub.proofs.map((p) => (
                                      <a
                                        key={p.id}
                                        href={`${API_HOST}${p.fileUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm underline text-text-main"
                                      >
                                        {p.fileName}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {canReview && (
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    disabled={busy}
                                    onClick={() => openReview(sub.id, t.title)}
                                  >
                                    Review
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Modal
        open={assignOpen}
        title="New Task"
        subtitle="Create a task and optionally set a due date."
        onClose={() => (!busy ? setAssignOpen(false) : null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setAssignOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={createTask} disabled={busy}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="Description (optional)"
          />
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full rounded-xl border border-primary/20 glass-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          >
            <option value="">Select assignee</option>
            {assigneeOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} • {u.email}
              </option>
            ))}
          </select>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            placeholder="Due date (optional)"
          />
          <div className="text-xs text-text-muted">
            Tip: Add a clear title + expected proof (screenshot/PDF) in the
            description.
          </div>
        </div>
      </Modal>

      <Modal
        open={reviewOpen}
        title={`Review Submission${
          reviewTarget ? ` — ${reviewTarget.taskTitle}` : ""
        }`}
        subtitle="Approve if proof is valid. Reject with a comment if changes are needed."
        onClose={() => (!busy ? setReviewOpen(false) : null)}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setReviewOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => review("REJECT")}
                disabled={busy}
              >
                Reject
              </Button>
              <Button onClick={() => review("ACCEPT")} disabled={busy}>
                Approve
              </Button>
            </div>
          </div>
        }
      >
        <Textarea
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          rows={4}
          placeholder="Comment (optional)…"
        />
      </Modal>
    </AppShell>
  );
}
