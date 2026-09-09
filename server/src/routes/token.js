import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";

const router = Router();

/**
 * POST /api/token
 * body: { room: string, identity: string, isHost?: boolean }
 * Returns a signed LiveKit JWT the client uses to join a room.
 */
router.post("/token", async (req, res) => {
  const { room, identity, isHost } = req.body || {};

  if (!room || !identity) {
    return res.status(400).json({ error: "room and identity are required" });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({
      error:
        "Server is missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET. Add them to server/.env",
    });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity,
      // metadata travels with the participant and lets the client know
      // who's allowed to see the engagement dashboard
      metadata: JSON.stringify({ isHost: !!isHost }),
    }
  );

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  res.json({ token, url: process.env.LIVEKIT_URL });
});

export default router;
