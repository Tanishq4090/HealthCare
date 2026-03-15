// supabase/functions/whatsapp/attendance.ts
// Called from the main webhook BEFORE the lead bot logic.
// If the sender is a known staff member and says START/END, handle attendance.
// Returns true if handled (so the main bot skips processing).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Keywords that trigger attendance (Hindi + English)
const START_WORDS = ["start", "started", "शुरू", "शुरु", "आया", "आई", "present", "duty start", "on duty"];
const END_WORDS   = ["end", "ended", "done", "finish", "finished", "खत्म", "गया", "गई", "off duty", "duty end", "duty over"];

function isStart(msg: string) {
  const m = msg.trim().toLowerCase();
  return START_WORDS.some(w => m === w || m.startsWith(w + " "));
}

function isEnd(msg: string) {
  const m = msg.trim().toLowerCase();
  return END_WORDS.some(w => m === w || m.startsWith(w + " "));
}

function twiml(text: string) {
  const safe = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

export async function handleAttendance(from: string, body: string): Promise<Response | null> {
  const start = isStart(body);
  const end   = isEnd(body);
  if (!start && !end) return null;  // not an attendance command

  // Check if this number is a registered staff member
  const { data: staff } = await supabase
    .from("staff")
    .select("id, name")
    .eq("whatsapp_number", from)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return null;  // not staff — let lead bot handle it

  // Find their active assignment
  const { data: assignment } = await supabase
    .from("staff_assignments")
    .select("id, client_id, clients(name)")
    .eq("staff_id", staff.id)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment) {
    return twiml(`Hi ${staff.name}, you don't have an active assignment right now. Contact the office if this is wrong. 📞 +91 9016116564`);
  }

  const today = new Date().toISOString().split("T")[0];
  const now   = new Date().toISOString();
  const clientName = (assignment as any).clients?.name ?? "client";

  if (start) {
    // Check if already checked in today
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, check_in, check_out")
      .eq("assignment_id", assignment.id)
      .eq("duty_date", today)
      .maybeSingle();

    if (existing?.check_in && !existing?.check_out) {
      const checkedInAt = new Date(existing.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      return twiml(`${staff.name}, you already checked in at ${checkedInAt} today. Send END when duty is over. ✅`);
    }

    if (existing?.check_in && existing?.check_out) {
      return twiml(`${staff.name}, you've already completed duty for today. Contact office for corrections. 📞`);
    }

    // Guard: check for any open shift across ALL assignments (not just today)
    // Prevents START START START creating ghost rows
    const { data: openShift } = await supabase
      .from("attendance")
      .select("id, duty_date, staff_assignments(clients(name))")
      .eq("assignment_id", assignment.id)
      .is("check_out", null)
      .not("check_in", "is", null)
      .neq("duty_date", today)  // different day = forgotten shift
      .maybeSingle();

    if (openShift) {
      const openDate = openShift.duty_date;
      return twiml(`${staff.name}, you have an open shift from ${openDate} that was never ended. Please contact the office to fix it before starting a new shift. 📞 +91 9016116564`);
    }

    // Fetch current hourly rate to snapshot into the attendance row
    const { data: rateRow } = await supabase
      .from("staff_assignments")
      .select("hourly_rate, service_requests(hourly_rate)")
      .eq("id", assignment.id)
      .single();
    const hourlyRate = (rateRow as any)?.hourly_rate
      ?? (rateRow as any)?.service_requests?.hourly_rate
      ?? null;

    // Create attendance record
    await supabase.from("attendance").upsert({
      assignment_id:        assignment.id,
      duty_date:            today,
      check_in:             now,
      check_in_method:      "whatsapp",
      is_absent:            false,
      hourly_rate_snapshot: hourlyRate,   // locked at check-in time
    }, { onConflict: "assignment_id,duty_date" });

    // Log the message
    await supabase.from("communications").insert({
      client_id:    assignment.client_id,
      whatsapp_number: from,
      direction:    "incoming",
      message_body: body,
      message_type: "text",
    });

    const time = new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return twiml(`✅ Duty started!\n\nStaff: ${staff.name}\nClient: ${clientName}\nTime: ${time}\n\nSend END when duty is over.`);
  }

  if (end) {
    // Find today's check-in
    const { data: record } = await supabase
      .from("attendance")
      .select("id, check_in, check_out")
      .eq("assignment_id", assignment.id)
      .eq("duty_date", today)
      .maybeSingle();

    if (!record?.check_in) {
      return twiml(`${staff.name}, no check-in found for today. Did you send START? Contact office if needed. 📞`);
    }

    if (record.check_out) {
      return twiml(`${staff.name}, duty already ended today. Contact office for corrections. 📞`);
    }

    // Calculate hours worked
    const hoursWorked = (new Date(now).getTime() - new Date(record.check_in).getTime()) / 3600000;
    const hrsDisplay  = `${Math.floor(hoursWorked)}h ${Math.round((hoursWorked % 1) * 60)}m`;

    await supabase.from("attendance")
      .update({ check_out: now, hours_worked: Math.round(hoursWorked * 100) / 100 })
      .eq("id", record.id);

    await supabase.from("communications").insert({
      client_id:    assignment.client_id,
      whatsapp_number: from,
      direction:    "incoming",
      message_body: body,
      message_type: "text",
    });

    const endTime   = new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const startTime = new Date(record.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    return twiml(`✅ Duty ended!\n\nStaff: ${staff.name}\nClient: ${clientName}\nStart: ${startTime}\nEnd: ${endTime}\nHours: ${hrsDisplay}\n\nThank you! See you tomorrow. 🙏`);
  }

  return null;
}
