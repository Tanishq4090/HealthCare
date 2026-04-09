// Supabase Edge Function: Drip Campaign for No-Response Leads
// This function queries leads in the "New" pipeline stage that have not responded
// after a certain period and sends follow‑up WhatsApp messages using the existing
// meta‑whatsapp‑outbound function.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const META_WHATSAPP_URL = `${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`;

serve(async (req) => {
  try {
    // Only allow POST (triggered by a cron or manual call)
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch leads that are in "In Discussion" stage and need a drip step
    const { data: leads, error } = await supabase
      .from("crm_leads")
      .select("id, name, phone, whatsapp_number, drip_step, last_greeted_at")
      .eq("pipeline_stage", "In Discussion")
      .not("last_greeted_at", "is", null);
    if (error) throw error;

    const now = new Date();
    const tasks: Array<Promise<void>> = [];

    for (const lead of leads ?? []) {
      const step = lead.drip_step ?? 0;
      const last = new Date(lead.last_greeted_at);
      
      let waitHours = 0;
      if (step === 0) waitHours = 48; // first follow‑up after 48h
      else if (step === 1) waitHours = 72; // second after 72h
      else if (step === 2) waitHours = 96; // third after 96h
      else continue; // already completed all steps

      if (now.getTime() - last.getTime() < waitHours * 3600 * 1000) {
        continue; // not enough time elapsed
      }

      // 1. Check if the user has responded since the last greeting/drip
      const { data: messages, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("phone", (lead.whatsapp_number || lead.phone).replace(/\D/g, ""))
        .eq("role", "user")
        .gt("created_at", lead.last_greeted_at)
        .limit(1);

      if (msgErr) {
        console.error(`Error checking messages for ${lead.phone}:`, msgErr.message);
        continue;
      }

      // If they responded, stop the drip for this lead
      if (messages && messages.length > 0) {
        console.log(`Lead ${lead.phone} has responded. Stopping drip.`);
        continue;
      }

      // 2. Send the drip message
      const templateName = `drip_step_${step + 1}_msg`;
      const templateParams = [lead.name ? lead.name.split("—")[0].trim() : "there"];
      const targetNumber = lead.whatsapp_number || lead.phone;
      const phoneDigits = targetNumber.replace(/\D/g, "");

      const payload = {
        phone: phoneDigits,
        leadId: lead.id,
        useTemplate: true,
        templateName,
        templateParams,
      };

      tasks.push(
        fetch(META_WHATSAPP_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`, // or a dedicated key
            "apikey": Deno.env.get("SUPABASE_ANON_KEY"),
          },
          body: JSON.stringify(payload),
        })
          .then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              console.error(`Drip send error for ${lead.phone}:`, err);
            } else {
                // Update the lead record only if send was successful
                await supabase
                  .from("crm_leads")
                  .update({
                    drip_step: step + 1,
                    last_greeted_at: now.toISOString(),
                  })
                  .eq("id", lead.id);
            }
          })
      );
    }

    await Promise.all(tasks);
    return new Response(JSON.stringify({ ok: true, processed: tasks.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Drip Campaign] Error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
