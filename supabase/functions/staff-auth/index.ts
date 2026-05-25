import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedAccesses = new Set(["dashboard", "crm", "clients", "hr", "finance"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const avatarForName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const sanitizeAccesses = (accesses: unknown): string[] => {
  if (!Array.isArray(accesses)) return [];
  return accesses.filter((access) => typeof access === "string" && allowedAccesses.has(access));
};

const randomSalt = () => crypto.randomUUID().replace(/-/g, "");

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashPassword = async (password: string, salt: string) => sha256(`${salt}:${password}`);

const toPublicUser = (row: any) => ({
  id: row.id,
  username: row.username,
  name: row.full_name,
  role: row.role,
  accesses: row.accesses || [],
  avatar: row.avatar || avatarForName(row.full_name || row.username),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const action = body?.action;

    if (action === "login") {
      const username = normalizeUsername(body.username || "");
      const password = String(body.password || "");
      if (!username || !password) return json({ error: "Username and password are required." }, 400);

      const { data: user, error } = await supabase
        .from("staff_users")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;
      if (!user) return json({ error: "Invalid username or password." }, 401);

      const incomingHash = await hashPassword(password, user.password_salt);
      if (incomingHash !== user.password_hash) {
        return json({ error: "Invalid username or password." }, 401);
      }

      return json({ user: toPublicUser(user) });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("staff_users")
        .select("id, username, full_name, role, accesses, avatar, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return json({ users: (data || []).map(toPublicUser) });
    }

    if (action === "create") {
      const username = normalizeUsername(body.username || "");
      const fullName = String(body.name || "").trim();
      const password = String(body.password || "");
      const accesses = sanitizeAccesses(body.accesses);

      if (!username || !fullName || !password) {
        return json({ error: "Full name, username, and password are required." }, 400);
      }

      const salt = randomSalt();
      const passwordHash = await hashPassword(password, salt);

      const { data, error } = await supabase
        .from("staff_users")
        .insert({
          username,
          full_name: fullName,
          role: "user",
          accesses,
          avatar: avatarForName(fullName),
          password_hash: passwordHash,
          password_salt: salt,
        })
        .select("id, username, full_name, role, accesses, avatar")
        .single();

      if (error) throw error;
      return json({ user: toPublicUser(data) });
    }

    if (action === "update") {
      const id = String(body.id || "");
      const username = normalizeUsername(body.username || "");
      const fullName = String(body.name || "").trim();
      const accesses = sanitizeAccesses(body.accesses);
      const password = body.password ? String(body.password) : "";

      if (!id || !username || !fullName) {
        return json({ error: "User id, full name, and username are required." }, 400);
      }

      const updatePayload: Record<string, unknown> = {
        username,
        full_name: fullName,
        accesses,
        avatar: avatarForName(fullName),
        updated_at: new Date().toISOString(),
      };

      if (password) {
        const salt = randomSalt();
        updatePayload.password_salt = salt;
        updatePayload.password_hash = await hashPassword(password, salt);
      }

      const { data, error } = await supabase
        .from("staff_users")
        .update(updatePayload)
        .eq("id", id)
        .select("id, username, full_name, role, accesses, avatar")
        .single();

      if (error) throw error;
      return json({ user: toPublicUser(data) });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ error: "User id is required." }, 400);

      const { error } = await supabase.from("staff_users").delete().eq("id", id).neq("role", "admin");
      if (error) throw error;

      return json({ ok: true });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (err) {
    console.error("[staff-auth]", err);
    return json({ error: err.message || "Staff auth request failed." }, 500);
  }
});

