const https = require('https');

const META_TOKEN = "EAAW02FFTvBkBRChqSq0kDkunOLnmWsCBi8ZBxQP9DsM3GZC4TrQZBaNZAuZCTanPdj71UpJ7ZCleklqZCSMXeCsdNjITkaxLG1TMMOUJ49u9kn64QJtXAqKvHYHK0fQSaSc7T2iZAUFMJzHVIjLSzwRM0fOsP4kOqpqgvVFN2hZC3FuNkdm8n8kKpSSvcjT50JzgprgZDZD";
const WABA_ID = "1663183461375745";

const options = {
    hostname: 'graph.facebook.com',
    path: `/v20.0/${WABA_ID}/message_templates?fields=name,status,components&limit=50`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${META_TOKEN}` }
};

const req = https.request(options, (res) => {
    let resData = '';
    res.on('data', chunk => resData += chunk);
    res.on('end', () => {
        const body = JSON.parse(resData);
        body.data?.forEach(t => {
            console.log(`\n--- ${t.name} [${t.status}] ---`);
            t.components?.forEach(c => {
                if (c.type === 'BODY') console.log('BODY:', c.text?.substring(0, 120));
                if (c.type === 'BUTTONS') console.log('BUTTONS:', JSON.stringify(c.buttons));
            });
        });
    });
});
req.on('error', (e) => console.log(e.message));
req.end();
