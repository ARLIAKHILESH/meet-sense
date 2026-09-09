import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import tokenRoute from "./routes/token.js";
import summarizeRoute from "./routes/summarize.js";
import { attachEngagementSocket } from "./ws/engagementSocket.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", tokenRoute);
app.use("/api", summarizeRoute);

const server = http.createServer(app);
attachEngagementSocket(server);

const port = process.env.PORT || 8787;
server.listen(port, () => {
  console.log(`MeetSense server listening on http://localhost:${port}`);
  console.log(`Engagement WebSocket at ws://localhost:${port}/ws/engagement`);
});
