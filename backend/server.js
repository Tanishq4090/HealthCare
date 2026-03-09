/**
 * server.js – HealthFirst WhatsApp Backend
 * With WebSocket (ws) for real-time CRM updates
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";
import { WebSocketServer } from "ws";

dotenv.config();

import whatsappRoutes, { setWss } from "./routes/whatsapp.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log("[WS] CRM client connected");
  ws.on("close", () => console.log("[WS] CRM client disconnected"));
});

// Broadcast to all connected CRM tabs
export function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Pass wss into routes so they can broadcast
setWss(broadcast);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/api/whatsapp/webhook", express.urlencoded({ extended: false }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/whatsapp", whatsappRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n✅  HealthFirst backend → http://localhost:${PORT}`);
  console.log(`   WebSocket ready for real-time CRM updates`);
});

export default app;
