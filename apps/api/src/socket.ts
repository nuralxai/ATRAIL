import { Server as IOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifyAccessToken } from "./utils/jwt.js";
import { prisma } from "./db.js";
import { chatPermissionsService } from "./modules/chat/chat-permissions.service.js";
import { PrismaClient } from "./generated/client/index.js";

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new IOServer(server, {
    cors: { origin: "http://localhost:3000", credentials: true },
  });

  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.accessToken;
      const cookieHeader = socket.handshake.headers.cookie;
      if (!token && cookieHeader) {
        const match = cookieHeader.match(/(?:^|; )accessToken=([^;]*)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (!token) return next(new Error("Missing token"));
      const payload = verifyAccessToken(token);
      (socket as any).user = {
        id: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const u = (socket as any).user;
    socket.join(`org:${u.orgId}`);
    socket.join(`user:${u.id}`);
    socket.join(`role:${u.role}`);

    socket.on(
      "conversation:join",
      async (payload: string | { conversationId: string }) => {
        // Handle both string and object payload formats
        const conversationId =
          typeof payload === "string" ? payload : payload.conversationId;

        // must be member
        const member = await prisma.conversationMember.findFirst({
          where: {
            conversationId,
            userId: u.id,
            conversation: { organizationId: u.orgId },
          },
        });
        if (!member) return;
        socket.join(`conv:${conversationId}`);
      }
    );

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Handle delivery receipts
    socket.on("message:delivered", async (payload: { conversationId: string; messageId: string }) => {
      try {
        await prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId: payload.conversationId, userId: u.id } },
          data: { lastDeliveredMessageId: payload.messageId }
        });
        io?.to(`conv:${payload.conversationId}`).emit("receipt:delivered", {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          userId: u.id
        });
      } catch (e) {
        // ignore if not a member or duplicate
      }
    });

    // Handle read receipts
    socket.on("message:read", async (payload: { conversationId: string; messageId: string }) => {
      try {
        await prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId: payload.conversationId, userId: u.id } },
          data: { lastReadMessageId: payload.messageId, lastDeliveredMessageId: payload.messageId }
        });
        io?.to(`conv:${payload.conversationId}`).emit("receipt:read", {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          userId: u.id
        });
      } catch (e) {
        // ignore
      }
    });

    // Handle typing events
    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("typing:start", {
        conversationId,
        userId: u.id
      });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId: u.id
      });
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket not initialized");
  return io;
}

// checkCanSendMessageSocket was removed to fix RBAC divergence with chat.service.ts

export function emitNewMessage(conversationId: string, payload: any) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("message:new", {
    conversationId,
    message: payload,
  });
}

// Emit new conversation event to both participants
export function emitNewConversation(
  orgId: string,
  userId1: string,
  userId2: string,
  conversation: any
) {
  if (!io) return;

  // Notify both users to refresh their conversation list
  io.to(`user:${userId1}`).emit("conversation:new", { conversation });
  io.to(`user:${userId2}`).emit("conversation:new", { conversation });

  // Also notify via org room for any connected clients
  io.to(`org:${orgId}`).emit("conversation:new", { conversation });

  // Auto-join both users to the conversation room if they're connected
  io.to(`user:${userId1}`).socketsJoin(`conv:${conversation.id}`);
  io.to(`user:${userId2}`).socketsJoin(`conv:${conversation.id}`);
}

// Emit emergency status change to all org members
export function emitEmergencyStatus(
  orgId: string,
  event: {
    id: string;
    status: "ACTIVE" | "RESOLVED" | "CANCELLED";
    triggeredAt: string;
    resolvedAt?: string | null;
    triggeredBy: { id: string; fullName: string; role: string };
    reason?: string | null;
    conversationId?: string;
  }
) {
  if (!io) return;
  io.to(`org:${orgId}`).emit("emergency:status", event);
}
