import { WebSocketServer } from "ws";

/**
 * Lightweight pub/sub over WebSocket, scoped by meeting room.
 *
 * Any client (usually each participant's own browser, which runs the
 * face-tracking locally) sends:
 *   { type: "engagement", room, identity, name, score, label }
 *
 * The server fans that out to every other client currently in the same
 * room. The host's dashboard listens for these and renders live bars.
 *
 * This deliberately does NOT send video frames to the server - the
 * computer vision runs entirely client-side (see client/src/hooks/
 * useEngagementTracking.js), so no participant's raw video ever leaves
 * their own browser for the purposes of engagement scoring.
 */
export function attachEngagementSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws/engagement" });

  // room -> Set of sockets
  const rooms = new Map();

  wss.on("connection", (socket) => {
    let joinedRoom = null;

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "join") {
        joinedRoom = msg.room;
        if (!rooms.has(joinedRoom)) rooms.set(joinedRoom, new Set());
        rooms.get(joinedRoom).add(socket);
        return;
      }

      // Forward anything except the initial "join" handshake - covers
      // both "engagement" score updates and "transcript-line" events.
      if (msg.type !== "join" && joinedRoom) {
        const peers = rooms.get(joinedRoom);
        if (!peers) return;
        const payload = JSON.stringify(msg);
        for (const peer of peers) {
          if (peer !== socket && peer.readyState === peer.OPEN) {
            peer.send(payload);
          }
        }
      }
    });

    socket.on("close", () => {
      if (joinedRoom && rooms.has(joinedRoom)) {
        rooms.get(joinedRoom).delete(socket);
        if (rooms.get(joinedRoom).size === 0) rooms.delete(joinedRoom);
      }
    });
  });

  return wss;
}
