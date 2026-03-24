import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Used Service Role to bypass RLS for server-side updates
    )

    const payload = await req.json()
    console.log("Received AI Webhook Payload:", JSON.stringify(payload))

    // Vapi Tool Call parsing
    if (payload.message && payload.message.type === 'tool-calls') {
      const toolCalls = payload.message.toolCalls;
      
      const responses = [];

      for (const call of toolCalls) {
        if (call.function.name === 'update_pipeline_status') {
          const args = call.function.arguments;
          const { client_id, status } = args;

          console.log(`Instructed to move lead ${client_id} to stage: ${status}`);

          if (!client_id || !status) {
             responses.push({
               toolCallId: call.id,
               type: "tool-call-result",
               result: "Error: Missing client_id or status arguments."
             });
             continue;
          }

          // Exact pipeline stages from the frontend
          const allowedStages = [
            'New Lead', 'New Inquiry', 'In Discussion', 'Quotation Sent', 
            'Form Submitted', 'Staff Assigned', 'Deposit Pending', 
            'Active Client', 'Monthly Billing', 'Closed Won', 'On Hold'
          ];

          // Smartly map AI output to our exact stages (case-insensitive)
          const normalizedStatusFromAI = status.toLowerCase().replace('_', ' ');
          let finalStatus = allowedStages.find(s => s.toLowerCase() === normalizedStatusFromAI) || status;

          // Special mapping if the AI uses common phrases
          if (normalizedStatusFromAI.includes('hold') || normalizedStatusFromAI.includes('wait') || normalizedStatusFromAI.includes('pause')) {
              finalStatus = 'On Hold';
          }
          if (normalizedStatusFromAI.includes('quote') || normalizedStatusFromAI.includes('quotation')) {
              finalStatus = 'Quotation Sent';
          }

          console.log(`Instructed to move lead ${client_id} to stage: ${finalStatus} (Raw: ${status})`);

          // Update the crm_leads table
          const { error } = await supabaseClient
            .from('crm_leads')
            .update({ pipeline_stage: finalStatus })
            .eq('id', client_id);

          if (error) {
            console.error("Supabase update error:", error);
            responses.push({
               toolCallId: call.id,
               type: "tool-call-result",
               result: "Failed to update database: " + error.message
             });
          } else {
             // Successful update
             responses.push({
               toolCallId: call.id,
               type: "tool-call-result",
               result: `Successfully updated the pipeline status to ${status}. Tell the user you have updated their profile.`
             });
          }
        }
      }

      // Vapi expects an array of results returned back
      return new Response(
        JSON.stringify({
          results: responses
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Default response if not a recognized tool call
    return new Response(JSON.stringify({ success: true, message: "Webhook received but no actionable tool call found." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Unhandled Error executing webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
