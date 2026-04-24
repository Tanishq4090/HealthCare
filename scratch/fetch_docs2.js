import https from 'https';

https.get('https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/components', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Just dump the text input section
    const match = data.match(/TextInput<\/code>(.*?)<\/table>/s);
    if(match) console.log(match[0].replace(/<[^>]*>?/gm, ' '));
  });
}).on('error', err => console.log(err.message));
