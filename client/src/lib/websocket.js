import { WS_BASE } from "./api.js";

/**
 * Connects to the engagement relay for a given room. Returns an object
 * with `send(payload)` and `onMessage(cb)` plus a `close()` to tear down.
 */
export function connectEngagementSocket(room) {
  const socket = new WebSocket(`${WS_BASE}/ws/engagement`);
  const listeners = new Set();

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join", room }));
  });

  socket.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      listeners.forEach((cb) => cb(msg));
    } catch {
      /* ignore malformed messages */
    }
  });

  return {
    send(payload) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close() {
      socket.close();
    },
  };
}
