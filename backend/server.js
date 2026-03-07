/**
 * server.js – HealthFirst WhatsApp Backend
 *
 * Start: node server.js
 * Dev:   nodemon server.js
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

import whatsappRoutes from "./routes/whatsapp.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan("dev"));

// CORS — allow your frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Meta webhooks send JSON bodies, so we just use the global JSON parser
app.use(express.json());

// Bypass ngrok browser warning interstitial for all API requests
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/whatsapp", whatsappRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "HealthFirst WhatsApp API", ts: new Date().toISOString() });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  HealthFirst WhatsApp API running on http://localhost:${PORT}`);
  console.log(`   Webhook URL: http://localhost:${PORT}/api/whatsapp/webhook`);
  console.log(
    `   Meta API:    ${process.env.META_ACCESS_TOKEN ? "✓ configured" : "⚠ META_ACCESS_TOKEN not set"}`
  );
});

export default app;
