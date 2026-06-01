import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import 'isomorphic-fetch'; // for ms graph client
import 'dotenv/config';
import { encrypt, decrypt } from "../../utils/encrypt.js";

// Initialize OAuth clients
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || "",
  process.env.GOOGLE_CLIENT_SECRET || "",
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/v1/integrations/google/callback"
);

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`
  }
};
const msalClient = new ConfidentialClientApplication(msalConfig);

export const integrationsService = {
  async listAccounts(userId: string) {
    return prisma.connectedAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, email: true, createdAt: true, updatedAt: true }
    });
  },

  async disconnectAccount(userId: string, accountId: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) throw new ApiError(404, "Connected account not found");
    
    await prisma.connectedAccount.delete({
      where: { id: account.id }
    });
    return true;
  },

  getGoogleAuthUrl(state: string) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.readonly',       // browse their Drive
        'https://www.googleapis.com/auth/drive.file',           // share/create links
      ]
    });
  },

  async handleGoogleCallback(userId: string, code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info to find the email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    // Store in DB
    const account = await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId, provider: 'GOOGLE' } },
      update: {
        accessToken: encrypt(tokens.access_token || ""),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || "",
        providerUserId: userInfo.data.id || "",
        scope: tokens.scope,
      },
      create: {
        userId,
        provider: 'GOOGLE',
        email: userInfo.data.email || "",
        accessToken: encrypt(tokens.access_token || ""),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        providerUserId: userInfo.data.id || "",
        scope: tokens.scope,
      }
    });

    return account;
  },

  async getMicrosoftAuthUrl(state: string) {
    const authCodeUrlParameters = {
      scopes: ["user.read", "Mail.ReadWrite", "Calendars.ReadWrite", "offline_access"],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || "http://localhost:4000/api/v1/integrations/microsoft/callback",
      state
    };
    return await msalClient.getAuthCodeUrl(authCodeUrlParameters);
  },

  async handleMicrosoftCallback(userId: string, code: string) {
    const tokenRequest = {
      code,
      scopes: ["user.read", "Mail.ReadWrite", "Calendars.ReadWrite", "offline_access"],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || "http://localhost:3000/settings/callback",
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);
    
    if (!response || !response.account) {
      throw new ApiError(400, "Failed to authenticate with Microsoft");
    }

    const { account, accessToken, expiresOn } = response;
    // Microsoft MSAL handles refresh tokens internally through the cache, but let's store what we can.
    
    const dbAccount = await prisma.connectedAccount.upsert({
      where: { userId_provider: { userId, provider: 'MICROSOFT' } },
      update: {
        accessToken: encrypt(accessToken),
        expiresAt: expiresOn,
        email: account.username || "",
        providerUserId: account.homeAccountId || "",
        scope: tokenRequest.scopes.join(" ")
      },
      create: {
        userId,
        provider: 'MICROSOFT',
        email: account.username || "",
        accessToken: encrypt(accessToken),
        expiresAt: expiresOn,
        providerUserId: account.homeAccountId || "",
        scope: tokenRequest.scopes.join(" ")
      }
    });

    return dbAccount;
  },

  // ----------------------------------------------------
  // DATA FETCHING (CALENDAR & MAIL)
  // ----------------------------------------------------

  async getGoogleCalendarEvents(accountId: string) {
    const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.provider !== 'GOOGLE') throw new Error("Invalid Google account");

    oauth2Client.setCredentials({
      access_token: decrypt(account.accessToken),
      refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return res.data.items?.map(item => ({
      id: item.id,
      title: item.summary,
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      provider: 'GOOGLE'
    })) || [];
  },

  async getGoogleMails(accountId: string) {
    const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.provider !== 'GOOGLE') throw new Error("Invalid Google account");

    oauth2Client.setCredentials({
      access_token: decrypt(account.accessToken),
      refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.messages.list({ userId: 'me', maxResults: 15 });
    
    if (!res.data.messages) return [];

    const emails = await Promise.all(res.data.messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
      const headers = detail.data.payload?.headers;
      const subject = headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
      return { id: msg.id, subject, from, snippet: detail.data.snippet, provider: 'GOOGLE' };
    }));

    return emails;
  },

  async getMicrosoftCalendarEvents(accountId: string) {
    const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.provider !== 'MICROSOFT') throw new Error("Invalid Microsoft account");

    const client = Client.init({
      authProvider: (done) => {
        done(null, decrypt(account.accessToken)); // Note: Should handle token refresh in production
      }
    });

    const res = await client.api('/me/calendarview')
      .query({
        startDateTime: new Date().toISOString(),
        endDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('subject,start,end')
      .top(20)
      .get();
      
    return res.value.map((item: any) => ({
      id: item.id,
      title: item.subject,
      start: item.start.dateTime,
      end: item.end.dateTime,
      provider: 'MICROSOFT'
    }));
  },

  async getMicrosoftMails(accountId: string) {
    const account = await prisma.connectedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.provider !== 'MICROSOFT') throw new Error("Invalid Microsoft account");

    const client = Client.init({
      authProvider: (done) => {
        done(null, decrypt(account.accessToken));
      }
    });

    const res = await client.api('/me/messages')
      .select('subject,sender,bodyPreview')
      .top(15)
      .get();

    return res.value.map((item: any) => ({
      id: item.id,
      subject: item.subject,
      from: item.sender?.emailAddress?.name || item.sender?.emailAddress?.address || 'Unknown',
      snippet: item.bodyPreview,
      provider: 'MICROSOFT'
    }));
  },

  // ----------------------------------------------------
  // GOOGLE DRIVE — User's own storage, zero hosting cost
  // ----------------------------------------------------

  async listDriveFiles(userId: string, folderId?: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'GOOGLE' }
    });
    if (!account) throw new ApiError(404, 'No Google account connected. Connect Google from Settings first.');

    oauth2Client.setCredentials({
      access_token: decrypt(account.accessToken),
      refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const query = folderId
      ? `'${folderId}' in parents and trashed=false`
      : `'root' in parents and trashed=false`;

    const res = await drive.files.list({
      q: query,
      fields: 'files(id,name,mimeType,iconLink,webViewLink,webContentLink,size,modifiedTime,owners)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    return (res.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      iconUrl: f.iconLink,
      viewLink: f.webViewLink,     // opens in Google Drive browser
      downloadLink: f.webContentLink,
      size: f.size,
      modifiedAt: f.modifiedTime,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }));
  },

  async searchDriveFiles(userId: string, query: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'GOOGLE' }
    });
    if (!account) throw new ApiError(404, 'No Google account connected.');

    oauth2Client.setCredentials({
      access_token: decrypt(account.accessToken),
      refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const res = await drive.files.list({
      q: `name contains '${query.replace(/'/g, "\\'") }' and trashed=false`,
      fields: 'files(id,name,mimeType,iconLink,webViewLink,size,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 30,
    });

    return (res.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      iconUrl: f.iconLink,
      viewLink: f.webViewLink,
      size: f.size,
      modifiedAt: f.modifiedTime,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }));
  },

  async getDriveShareLink(userId: string, fileId: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'GOOGLE' }
    });
    if (!account) throw new ApiError(404, 'No Google account connected.');

    oauth2Client.setCredentials({
      access_token: decrypt(account.accessToken),
      refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Make file publicly viewable (anyone with link)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const file = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,webViewLink,webContentLink,size',
    });

    return {
      id: file.data.id,
      name: file.data.name,
      mimeType: file.data.mimeType,
      shareLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink,
      size: file.data.size,
    };
  },

  // ----------------------------------------------------
  // MICROSOFT ONEDRIVE — User's own storage
  // ----------------------------------------------------

  async listOneDriveFiles(userId: string, folderId?: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'MICROSOFT' }
    });
    if (!account) throw new ApiError(404, 'No Microsoft account connected. Connect Microsoft from Settings first.');

    const client = Client.init({ authProvider: (done) => done(null, decrypt(account.accessToken)) });

    const endpoint = folderId
      ? `/me/drive/items/${folderId}/children`
      : '/me/drive/root/children';

    const res = await client.api(endpoint)
      .select('id,name,file,folder,size,lastModifiedDateTime,webUrl,@microsoft.graph.downloadUrl')
      .top(50)
      .get();

    return (res.value || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.file?.mimeType || (f.folder ? 'folder' : 'application/octet-stream'),
      size: f.size ? String(f.size) : null,
      modifiedAt: f.lastModifiedDateTime,
      viewLink: f.webUrl,
      isFolder: !!f.folder,
    }));
  },

  async searchOneDriveFiles(userId: string, query: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'MICROSOFT' }
    });
    if (!account) throw new ApiError(404, 'No Microsoft account connected.');

    const client = Client.init({ authProvider: (done) => done(null, decrypt(account.accessToken)) });

    const res = await client.api(`/me/drive/root/search(q='${query.replace(/'/g, "''")}')`).get();

    return (res.value || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.file?.mimeType || (f.folder ? 'folder' : 'application/octet-stream'),
      size: f.size ? String(f.size) : null,
      modifiedAt: f.lastModifiedDateTime,
      viewLink: f.webUrl,
      isFolder: !!f.folder,
    }));
  },

  async getOneDriveShareLink(userId: string, itemId: string) {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: 'MICROSOFT' }
    });
    if (!account) throw new ApiError(404, 'No Microsoft account connected.');

    const client = Client.init({ authProvider: (done) => done(null, decrypt(account.accessToken)) });

    // Create an "anyone with link can view" share
    const res = await client.api(`/me/drive/items/${itemId}/createLink`)
      .post({ type: 'view', scope: 'organization' });

    const meta = await client.api(`/me/drive/items/${itemId}`)
      .select('id,name,file,size')
      .get();

    return {
      id: itemId,
      name: meta.name,
      mimeType: meta.file?.mimeType || 'application/octet-stream',
      shareLink: res.link?.webUrl || meta.webUrl,
      size: meta.size ? String(meta.size) : null,
    };
  },
};
