const payload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "id": "wamid.TEST1235",
                "type": "interactive",
                "interactive": {
                  "type": "nfm_reply",
                  "nfm_reply": {
                    "response_json": JSON.stringify({
                      "flow_type": "patient_care_form",
                      "full_name": "Test Mock",
                      "duties": ["massage", "feeding"],
                      "other_work": "Test other work"
                    })
                  }
                },
                "from": "918000044090"
              }
            ],
            "contacts": [{"wa_id": "918000044090"}]
          }
        }
      ]
    }
  ]
};

fetch('https://sgyladamwnanudnropwl.supabase.co/functions/v1/whatsapp-elevenlabs-bot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(async r => {
  console.log(r.status, await r.text());
});
