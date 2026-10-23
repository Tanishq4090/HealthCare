import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { phone, otp, purpose = "admin_2fa_login" } = payload;

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: phone and otp." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number to 10 digits for Indian carriers
    const digits = String(phone).replace(/\D/g, "");
    const clean10 = digits.slice(-10);

    if (clean10.length !== 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid mobile number. Must be a valid 10-digit number." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve Fast2SMS API Key from Environment or Database Settings
    let apiKey = Deno.env.get("FAST2SMS_API_KEY");

    if (!apiKey && supabaseUrl) {
      try {
        const { data: settings } = await supabase
          .from("automation_settings")
          .select("fast2sms_api_key")
          .eq("id", "global")
          .maybeSingle();

        if (settings?.fast2sms_api_key) {
          apiKey = settings.fast2sms_api_key;
        }
      } catch (err) {
        console.warn("Failed to read fast2sms_api_key from automation_settings:", err);
      }
    }

    if (!apiKey) {
      console.warn(`[SMS] Fast2SMS API key not set. Simulating SMS dispatch for ${clean10}.`);
      return new Response(
        JSON.stringify({
          success: false,
          keyMissing: true,
          error: "Fast2SMS API key not configured. Add your key in Settings → Access Control to deliver live SMS.",
          phone: clean10,
          simulatedOtp: otp
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Fast2SMS Bulk V2 OTP Route
    console.log(`[Fast2SMS] Dispatching cellular SMS OTP to ${clean10}...`);
    const f2sResponse = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: String(otp),
        numbers: clean10,
      }),
    });

    const f2sData = await f2sResponse.json();
    console.log("[Fast2SMS] Response status:", f2sResponse.status, f2sData);

    const isSuccess = f2sData?.return === true;

    // Log to whatsapp_logs / sms_logs table for audit visibility
    try {
      await supabase.from("whatsapp_logs").insert({
        sid: isSuccess ? (f2sData.request_id || `sms_${Date.now()}`) : `sms_err_${Date.now()}`,
        status: isSuccess ? "delivered_sms" : "failed_sms",
        error_code: isSuccess ? null : "FAST2SMS_FAIL",
        error_message: isSuccess ? null : (Array.isArray(f2sData?.message) ? f2sData.message.join(", ") : String(f2sData?.message || "Unknown error")),
        payload: {
          channel: "cellular_sms",
          provider: "fast2sms",
          recipient: clean10,
          purpose,
          f2s_response: f2sData,
        },
      });
    } catch (logErr) {
      console.warn("Failed to write SMS delivery log:", logErr);
    }

    if (isSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          channel: "sms",
          message: "SMS OTP sent directly to phone Messages inbox.",
          requestId: f2sData.request_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errMsg = Array.isArray(f2sData?.message)
        ? f2sData.message.join(", ")
        : String(f2sData?.message || "Fast2SMS delivery failed.");

      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          details: f2sData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[SMS] Internal Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to dispatch SMS OTP." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
