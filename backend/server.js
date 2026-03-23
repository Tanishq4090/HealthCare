/**
 * server.js – HealthFirst WhatsApp Backend
 * With WebSocket (ws) for real-time CRM updates
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { supabase } from "./services/supabase.js";

dotenv.config();

import whatsappRoutes, { setWss } from "./routes/whatsapp.js";
import attendanceRoutes from "./routes/attendance.js";
import crmRoutes from "./routes/crm.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// ── Serverless Realtime Broadcaster ──────────────────────────────────────────
const crmChannel = supabase.channel('crm_updates');
crmChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('[Realtime] Backend connected to crm_updates channel for broadcasting.');
  }
});

export function broadcast(event, data) {
  const payload = { event, data, ts: Date.now() };
  
  // Standard Supabase broadcast payload format
  crmChannel.send({
    type: 'broadcast',
    event: 'crm_event',
    payload: payload
  }).catch(err => console.error('[Realtime Broadcast Error]', err));
}

// Pass wss into routes so they can broadcast
setWss(broadcast);

// ── Middleware ────────────────────────────────────────────────────────────────
app.set("trust proxy", 1); // Trust first proxy for HTTPS termination protocols

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: false, // Prevents breaking inline scripts if serving views
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? "combined" : "dev"));

// ── Rate Limiting (Global Anti-Scraping / Abuse) ───────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // Limit each IP to 200 requests per `window`
  standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use("/api/", globalLimiter);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"],
}));

app.use("/api/whatsapp/webhook", express.urlencoded({ extended: false }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/crm-config", requireAuth, crmRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, _next) => {
  console.error({
    message: "[Global Error] Internal API Error",
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n✅  HealthFirst backend → http://localhost:${PORT}`);
  console.log(`   WebSocket ready for real-time CRM updates`);
});

export default app;
