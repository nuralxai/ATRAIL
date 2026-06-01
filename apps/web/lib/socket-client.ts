import { io, type Socket } from "socket.io-client";
import { API_HOST } from "./config";

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (socket && socket.connected) return socket;

  socket = io(API_HOST, {
    transports: ["websocket"],
    auth: { accessToken: accessToken },
  });

  return socket;
}

export function closeSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
