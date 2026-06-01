import { authedFetch } from "./authed-fetch";

export type ConversationItem =
  | {
      id: string;
      type: "DIRECT";
      project: null;
      otherUser: { id: string; fullName: string; role: string } | null;
      lastMessage: {
        id: string;
        body: string;
        createdAt: string;
        senderId: string;
      } | null;
      canSend: boolean;
      unreadCount?: number;
    }
  | {
      id: string;
      type: "PROJECT";
      project: { id: string; name: string } | null;
      otherUser: null;
      lastMessage: {
        id: string;
        body: string;
        createdAt: string;
        senderId: string;
      } | null;
      canSend: true;
      unreadCount?: number;
    };

export async function listConversations() {
  return authedFetch<{ ok: true; conversations: ConversationItem[] }>(
    "/chat/conversations"
  );
}

export async function getMessages(conversationId: string) {
  return authedFetch<{ ok: true; messages: any[]; nextCursor: string | null }>(
    `/chat/conversations/${conversationId}/messages?limit=50`
  );
}

export async function sendMessage(conversationId: string, body: string, file?: { url: string; name: string; type: string }) {
  return authedFetch<{ ok: true; message: any }>(
    `/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body, file }),
    }
  );
}

export async function markConversationRead(conversationId: string) {
  return authedFetch<{ ok: true }>(
    `/chat/conversations/${conversationId}/read`,
    { method: "POST" }
  );
}

export async function deleteMessage(messageId: string) {
  return authedFetch<{ ok: true }>(
    `/chat/messages/${messageId}`,
    { method: "DELETE" }
  );
}
