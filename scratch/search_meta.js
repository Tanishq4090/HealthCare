const https = require('https');

https.get('https://developers.facebook.com/docs/whatsapp/flows/reference/flow-json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const snippet = data.match(/template-messages/g);
    console.log("Snippet found:", snippet !== null);
  });
}).on('error', err => console.log(err.message));
