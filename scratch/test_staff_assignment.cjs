const https = require('https');

const META_TOKEN = "EAAW02FFTvBkBRChqSq0kDkunOLnmWsCBi8ZBxQP9DsM3GZC4TrQZBaNZAuZCTanPdj71UpJ7ZCleklqZCSMXeCsdNjITkaxLG1TMMOUJ49u9kn64QJtXAqKvHYHK0fQSaSc7T2iZAUFMJzHVIjLSzwRM0fOsP4kOqpqgvVFN2hZC3FuNkdm8n8kKpSSvcjT50JzgprgZDZD";
const META_PHONE_ID = "1067359809794764";

function sendMetaRequest(payload) {
    const data = JSON.stringify(payload);
    const options = {
        hostname: 'graph.facebook.com',
        path: `/v21.0/${META_PHONE_ID}/messages`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(resData) }));
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.write(data);
        req.end();
    });
}

async function runTests() {
    console.log("Test staff_assignment template:");
    let res = await sendMetaRequest({
        messaging_product: "whatsapp",
        to: "918000044090",
        type: "template",
        template: {
            name: "staff_assignment",
            language: { code: "en" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: "Tanishq" },
                        { type: "text", text: "Head Nurse" },
                        { type: "text", text: "https://health-care-iota-red.vercel.app/id-card/test123" }
                    ]
                }
            ]
        }
    });
    console.log(JSON.stringify(res.body, null, 2));
}
runTests();
