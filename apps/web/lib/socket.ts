import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./auth-store";

let socket: Socket | null = null;

export function getSocket() {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    socket = io(process.env.NEXT_PUBLIC_API_HOST ?? "http://localhost:4000", {
      auth: token ? { accessToken: token } : undefined,
      withCredentials: true,
    });
  }

  return socket;
}

export function resetSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
