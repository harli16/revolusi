// src/utils/socket.js
import { io } from "socket.io-client";

// 🔥 langsung pakai dari .env
const SOCKET_URL = import.meta.env.VITE_API_URL;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
