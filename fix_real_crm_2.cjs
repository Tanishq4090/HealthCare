const fs = require('fs');
const path = './src/admin/CRM.tsx';
let content = fs.readFileSync(path, 'utf8');

const filterCode2 = `
            const rawRows = (data || []).filter((l) => !isManualInvoiceLead(l));
            // Filter duplicates
            const uniqueRows = [];
            const phoneMap3 = new Set();
            for (const l of rawRows) {
                const phoneDigits = (l.phone || l.whatsapp_number || '').replace(/\\D/g, '').slice(-10);
                if (phoneDigits && phoneDigits.length === 10) {
                    if (phoneMap3.has(phoneDigits)) continue;
                    phoneMap3.add(phoneDigits);
                }
                uniqueRows.push(l);
            }
            const rows = uniqueRows;
`;

content = content.replace(
`            const rows = (data || []).filter((l) => !isManualInvoiceLead(l));`,
filterCode2
);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated REAL CRM.tsx again");
