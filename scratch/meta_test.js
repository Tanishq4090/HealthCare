console.log(JSON.stringify({
  type: "button",
  sub_type: "flow",
  index: "0",
  parameters: [
    {
      type: "action",
      action: {
        flow_token: `flow_123`,
        flow_action_data: {
          screen: "CONSENT_SCREEN"
        }
      }
    }
  ]
}));
