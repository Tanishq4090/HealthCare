const https = require('https');

const META_TOKEN = "EAAW02FFTvBkBRChqSq0kDkunOLnmWsCBi8ZBxQP9DsM3GZC4TrQZBaNZAuZCTanPdj71UpJ7ZCleklqZCSMXeCsdNjITkaxLG1TMMOUJ49u9kn64QJtXAqKvHYHK0fQSaSc7T2iZAUFMJzHVIjLSzwRM0fOsP4kOqpqgvVFN2hZC3FuNkdm8n8kKpSSvcjT50JzgprgZDZD";
const WABA_ID = "1663183461375745";

const options = {
    hostname: 'graph.facebook.com',
    path: `/v20.0/${WABA_ID}/message_templates?name=consent_form`,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${META_TOKEN}`
    }
};

const req = https.request(options, (res) => {
    let resData = '';
    res.on('data', chunk => resData += chunk);
    res.on('end', () => {
        const body = JSON.parse(resData);
        console.log(JSON.stringify(body, null, 2));
    });
});
req.on('error', (e) => console.log(e.message));
req.end();
