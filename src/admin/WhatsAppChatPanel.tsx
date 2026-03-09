import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read";
}

interface Conversation {
  id?: string;
  phone: string;
  name: string;
  leadId?: string;
  leadStage?: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  aiEnabled: boolean;
  messages: Message[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function stageColor(stage?: string) {
  switch (stage) {
    case "New Lead": return "#3b82f6";
    case "In Discussion": return "#f59e0b";
    case "Quotation Sent": return "#8b5cf6";
    case "Form Submitted": return "#10b981";
    default: return "#94a3b8";
  }
}
const AVATAR_COLORS = ["#0ea5e9", "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6"];
function avatarColor(name: string) {
  if (!name) return "#94a3b8";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function timeAgo(dateStr: string) {
  return dateStr || "Just now";
}

// ── WebSocket URL (auto-detect backend) ──────────────────────────────────────
const WS_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001")
  .replace("https://", "wss://")
  .replace("http://", "ws://");

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export default function WhatsAppChatPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [aiTypingFor, setAiTypingFor] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const active = conversations.find((c) => c.phone === activePhone) ?? null;

  // ── Fetch conversations on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/whatsapp/conversations`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConversations(data);
          if (data.length > 0) setActivePhone(data[0].phone);
        } else {
          setConversations([]);
        }
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  // ── WebSocket for real-time updates ──────────────────────────────────────
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
        console.log("[WS] Connected to backend");
      };

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data);

          if (event === "new_message") {
            // Append message to the right conversation
            setConversations((prev) =>
              prev.map((c) => {
                if (c.phone !== data.phone) return c;
                const already = c.messages.some((m) => m.id === data.message.id);
                if (already) return c;
                return {
                  ...c,
                  messages: [...c.messages, data.message],
                  lastMessage: data.message.content.slice(0, 80),
                  lastMessageTime: data.message.timestamp,
                  unread: data.message.role === "user" ? c.unread + 1 : c.unread,
                };
              })
            );
          }

          if (event === "conversation_updated") {
            setConversations((prev) => {
              const exists = prev.find((c) => c.phone === data.phone);
              if (exists) return prev.map((c) => c.phone === data.phone ? { ...c, ...data } : c);
              return [data, ...prev]; // New conversation — add to top
            });
          }

          if (event === "ai_typing") {
            setAiTypingFor(data.typing ? data.phone : null);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimeout = setTimeout(connect, 3000); // auto-reconnect
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, aiTypingFor]);

  // ── Mark read on switch ───────────────────────────────────────────────────
  const selectConversation = useCallback((phone: string) => {
    setActivePhone(phone);
    setConversations((prev) => prev.map((c) => c.phone === phone ? { ...c, unread: 0 } : c));
    fetch(`${API_BASE}/api/whatsapp/conversations/${encodeURIComponent(phone)}/read`, { method: "POST" });
  }, []);

  // ── Toggle AI ─────────────────────────────────────────────────────────────
  const toggleAI = useCallback((phone: string, enabled: boolean) => {
    setConversations((prev) => prev.map((c) => c.phone === phone ? { ...c, aiEnabled: !enabled } : c));
    fetch(`${API_BASE}/api/whatsapp/conversations/${encodeURIComponent(phone)}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending || !active) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic UI update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      role: "agent",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.phone === active.phone
          ? { ...c, messages: [...c.messages, optimistic], lastMessage: text, lastMessageTime: "Just now" }
          : c
      )
    );

    try {
      await fetch(`${API_BASE}/api/whatsapp/conversations/${encodeURIComponent(active.phone)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const filtered = conversations.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .wa-panel * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        .conv-item { cursor:pointer; transition: background 0.12s; border-left: 3px solid transparent; }
        .conv-item:hover { background: #f8fafc; }
        .conv-item.active { background: #f0fdf4; border-left-color: #25D366; }
        .send-btn:hover:not(:disabled) { background: #1aab54 !important; transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .send-btn { transition: all 0.15s; }
        .bubble { animation: bIn 0.18s ease; }
        @keyframes bIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .wa-typing span { display:inline-block;width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:bounce 1.2s infinite;margin:0 1px; }
        .wa-typing span:nth-child(2){animation-delay:.2s}
        .wa-typing span:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        .ws-dot { width:7px;height:7px;border-radius:50%;display:inline-block; }
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}
        textarea:focus { outline: none; border-color: #25D366 !important; }
      `}</style>

      <div className="wa-panel" style={S.panel}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div style={S.sidebar}>
          <div style={S.sidebarTop}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={S.waIcon}>
                <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
                  <path d="M14 2C7.373 2 2 7.373 2 14c0 2.09.537 4.054 1.478 5.762L2 26l6.452-1.449A11.95 11.95 0 0014 26c6.627 0 12-5.373 12-12S20.627 2 14 2z" fill="white" fillOpacity=".3" />
                  <path d="M19.5 17.1c-.3-.15-1.77-.873-2.045-.972-.275-.099-.474-.148-.674.149-.2.297-.772.972-.946 1.172-.174.199-.349.224-.648.074-.3-.149-1.264-.466-2.408-1.486-.89-.794-1.49-1.774-1.664-2.073-.174-.3-.018-.461.13-.61.134-.132.299-.348.448-.522.15-.174.2-.298.3-.497.099-.198.05-.373-.025-.522-.075-.149-.674-1.623-.923-2.22-.243-.583-.49-.504-.674-.513l-.572-.01c-.2 0-.523.075-.797.373-.274.298-1.047 1.023-1.047 2.495 0 1.473 1.072 2.897 1.222 3.096.149.199 2.109 3.22 5.11 4.514.714.308 1.272.492 1.707.63.717.228 1.37.196 1.886.119.575-.086 1.77-.724 2.02-1.423.248-.7.248-1.297.173-1.423-.074-.124-.274-.198-.573-.348z" fill="white" />
                </svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>WhatsApp</span>
              {totalUnread > 0 && <span style={S.unreadTotal}>{totalUnread}</span>}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                <span className="ws-dot" style={{ background: wsStatus === "connected" ? "#25D366" : wsStatus === "connecting" ? "#f59e0b" : "#ef4444" }} />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{wsStatus}</span>
              </div>
            </div>

            {/* Search */}
            <div style={S.searchBox}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input style={S.searchInput} placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* List */}
          <div style={S.convList}>
            {loading && (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No conversations yet.<br />Messages from WhatsApp will appear here.
              </div>
            )}
            {filtered.map((c) => (
              <div
                key={c.phone}
                className={`conv-item ${c.phone === activePhone ? "active" : ""}`}
                style={S.convItem}
                onClick={() => selectConversation(c.phone)}
              >
                <div style={{ ...S.avatar, background: avatarColor(c.name) }}>{initials(c.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={S.convName}>{c.name}</span>
                    <span style={S.convTime}>{timeAgo(c.lastMessageTime)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={S.convPreview}>{(c.lastMessage || "").slice(0, 36)}{(c.lastMessage || "").length > 36 ? "…" : ""}</span>
                    {c.unread > 0 && <span style={S.unreadBadge}>{c.unread}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                    {c.leadStage && <span style={{ ...S.pill, background: stageColor(c.leadStage) + "18", color: stageColor(c.leadStage) }}>{c.leadStage}</span>}
                    {c.aiEnabled && <span style={{ ...S.pill, background: "#f0fdf4", color: "#16a34a" }}>🤖 AI ON</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat area ─────────────────────────────────────────────────── */}
        {active ? (
          <div style={S.chat}>
            {/* Header */}
            <div style={S.chatHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ ...S.avatarLg, background: avatarColor(active.name), position: "relative" }}>
                  {initials(active.name)}
                  <span style={S.onlineDot} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{active.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{active.phone}</div>
                </div>
                {active.leadStage && (
                  <span style={{ ...S.pill, background: stageColor(active.leadStage) + "18", color: stageColor(active.leadStage), fontSize: 11, padding: "3px 10px" }}>
                    {active.leadStage}
                  </span>
                )}
              </div>

              {/* AI Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active.aiEnabled ? "#25D366" : "#94a3b8" }}>
                    {active.aiEnabled ? "🤖 Claude AI ON" : "AI OFF"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{active.aiEnabled ? "Auto-replying" : "Manual mode"}</div>
                </div>
                <div
                  style={{ width: 44, height: 24, borderRadius: 12, background: active.aiEnabled ? "#25D366" : "#e2e8f0", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                  onClick={() => toggleAI(active.phone, active.aiEnabled)}
                >
                  <div style={{ position: "absolute", top: 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "transform 0.2s", transform: active.aiEnabled ? "translateX(22px)" : "translateX(2px)" }} />
                </div>
              </div>
            </div>

            {/* AI Banner */}
            {active.aiEnabled && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 20px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", fontSize: 12, color: "#15803d" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                Claude AI is auto-replying to this client in real-time via WhatsApp. You can override with a manual message below.
              </div>
            )}

            {/* Messages */}
            <div style={S.messages}>
              {(active.messages || []).map((msg) => (
                <div key={msg.id} className="bubble" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-start" : "flex-end", marginBottom: 10 }}>
                  {msg.role === "user" && (
                    <div style={{ ...S.avatarXs, background: avatarColor(active.name) }}>{initials(active.name)}</div>
                  )}
                  <div style={{ maxWidth: "62%" }}>
                    <div style={{
                      padding: "10px 14px",
                      border: "1.5px solid",
                      borderColor: msg.role === "user" ? "#e2e8f0" : msg.role === "assistant" ? "#bbf7d0" : "#bfdbfe",
                      background: msg.role === "user" ? "#fff" : msg.role === "assistant" ? "#f0fdf4" : "#eff6ff",
                      borderRadius: msg.role === "user" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                    }}>
                      {msg.role !== "user" && (
                        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, letterSpacing: "0.4px", color: msg.role === "assistant" ? "#25D366" : "#3b82f6" }}>
                          {msg.role === "assistant" ? "🤖 CLAUDE AI" : "👤 AGENT"}
                        </div>
                      )}
                      <div style={{ fontSize: 13.5, color: "#1e293b", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, textAlign: msg.role === "user" ? "left" : "right", paddingLeft: msg.role === "user" ? 4 : 0, paddingRight: msg.role === "user" ? 0 : 4 }}>
                      {msg.timestamp}{msg.status === "read" ? " ✓✓" : msg.status === "delivered" ? " ✓✓" : msg.status === "sent" ? " ✓" : ""}
                    </div>
                  </div>
                </div>
              ))}

              {/* AI typing */}
              {aiTypingFor === active.phone && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <div style={{ padding: "10px 16px", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: "16px 4px 16px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#25D366", marginBottom: 4 }}>🤖 CLAUDE AI</div>
                    <div className="wa-typing"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={S.inputArea}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  style={S.textarea}
                  placeholder={active.aiEnabled ? "Override AI — type a manual message to client…" : "Type a WhatsApp message…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button className="send-btn" style={S.sendBtn} onClick={sendMessage} disabled={!input.trim() || sending}>
                  {sending
                    ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  }
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                <kbd style={S.kbd}>Enter</kbd> to send · <kbd style={S.kbd}>Shift+Enter</kbd> new line
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexDirection: "column", gap: 12 }}>
            <div style={{ ...S.waIcon, width: 56, height: 56, borderRadius: 16, opacity: 0.4 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C7.373 2 2 7.373 2 14c0 2.09.537 4.054 1.478 5.762L2 26l6.452-1.449A11.95 11.95 0 0014 26c6.627 0 12-5.373 12-12S20.627 2 14 2z" fill="white" fillOpacity=".3" />
              </svg>
            </div>
            <p style={{ fontSize: 14 }}>Select a conversation to start</p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { width: "100%", height: "100%", minHeight: 520 },
  panel: { display: "flex", height: "calc(100vh - 140px)", minHeight: 500, background: "#f8fafc", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" },
  sidebar: { width: 290, flexShrink: 0, background: "#fff", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column" },
  sidebarTop: { padding: "16px 14px 12px", borderBottom: "1px solid #f1f5f9" },
  waIcon: { width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#25D366,#128C7E)", display: "flex", alignItems: "center", justifyContent: "center" },
  unreadTotal: { background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 7px" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "7px 12px" },
  searchInput: { border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#0f172a", width: "100%", fontFamily: "inherit" },
  convList: { flex: 1, overflowY: "auto" },
  convItem: { display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderBottom: "1px solid #f8fafc" },
  convName: { fontWeight: 600, fontSize: 13.5, color: "#0f172a" },
  convTime: { fontSize: 11, color: "#94a3b8", flexShrink: 0 },
  convPreview: { fontSize: 12.5, color: "#64748b", flex: 1, minWidth: 0 },
  unreadBadge: { background: "#25D366", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "1px 6px", flexShrink: 0 },
  pill: { display: "inline-block", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.2px" },
  avatar: { width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 },
  avatarLg: { width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 },
  avatarXs: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 10, marginRight: 8, marginTop: 2, flexShrink: 0 },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 10, height: 10, background: "#25D366", borderRadius: "50%", border: "2px solid #fff" },
  chat: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  chatHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: "#fff", borderBottom: "1px solid #f1f5f9", gap: 12 },
  messages: { flex: 1, overflowY: "auto", padding: "16px 18px", background: "#f8fafc" },
  inputArea: { padding: "12px 16px 14px", background: "#fff", borderTop: "1px solid #f1f5f9" },
  textarea: { flex: 1, resize: "none", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontFamily: "inherit", color: "#0f172a", background: "#f8fafc", lineHeight: 1.5, maxHeight: 120, overflowY: "auto", transition: "border-color 0.2s" },
  sendBtn: { width: 44, height: 44, borderRadius: 12, background: "#25D366", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  kbd: { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontFamily: "monospace" },
};
