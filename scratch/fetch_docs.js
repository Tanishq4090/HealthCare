import https from 'https';

https.get('https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/components', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const textInputMatch = data.match(/TextInput[\s\S]*?(?=TextHeading|TextArea|Dropdown|OptIn)/);
    if (textInputMatch) {
      console.log(textInputMatch[0].replace(/<[^>]*>?/gm, ''));
    } else {
      console.log("Not found");
    }
  });
}).on('error', err => console.log(err.message));
