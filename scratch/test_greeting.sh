#!/bin/bash

# Configuration
URL="https://sgyladamwnanudnropwl.supabase.co/functions/v1/elevenlabs-call-webhook"
PHONE="+917600004090"

echo "🚀 Simulating ElevenLabs Call Completion for $PHONE..."

curl -X POST "$URL" \
-H "Content-Type: application/json" \
-d '{
  "type": "post_call_transcription",
  "data": {
    "conversation_id": "sim_'"$(date +%s)"'",
    "agent_id": "test_agent",
    "transcript": [
      {"role": "agent", "message": "Namaste! How can I help you?"},
      {"role": "user", "message": "I am looking for Old Age Care for my father, looking for a 24-hour stay."}
    ],
    "metadata": {
      "phone_number": "'"$PHONE"'"
    },
    "analysis": {
      "data_collection_results": {
        "name": {"value": "Test User"}
      }
    }
  }
}'

echo -e "\n\n✅ Simulation payload sent. Check your WhatsApp and CRM 'Voice AI Calls' tab."
