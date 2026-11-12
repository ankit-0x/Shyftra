// client/src/socket.js
// One shared socket connection for the whole app — imported wherever
// it's needed, instead of creating a new connection per component.
import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_API_URL, {
  withCredentials: true, // sends the same accessToken cookie the server checks
  autoConnect: false, // we connect manually, only once we know someone's logged in
});