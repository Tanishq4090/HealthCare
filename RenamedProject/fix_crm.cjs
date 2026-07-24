const fs = require('fs');
const path = './src/admin/CRM.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the useEffect for expandedStages completely to guarantee they are closed
content = content.replace(
`    // Initialize all stages as closed by default
    useEffect(() => {
        if (pipelineStages.length > 0 && Object.keys(expandedStages).length === 0) {
            const initialExpanded: Record<string, boolean> = {};
            pipelineStages.forEach(stage => {
                initialExpanded[stage] = false;
            });
            setExpandedStages(initialExpanded);
        }
    }, [pipelineStages]);`,
`    // Stages start closed by default (empty expandedStages object means false)`
);

// 2. Filter duplicate leads in fetchLeads
const filterCode = `
                    const fallbackRows = (fallback || []).filter((l) => !isManualInvoiceLead(l));
                    
                    // Filter duplicates
                    const uniqueFallbackRows = [];
                    const phoneMap = new Set();
                    for (const l of fallbackRows) {
                        const phoneDigits = (l.phone || l.whatsapp_number || '').replace(/\\D/g, '').slice(-10);
                        if (phoneDigits && phoneDigits.length === 10) {
                            if (phoneMap.has(phoneDigits)) continue;
                            phoneMap.add(phoneDigits);
                        }
                        uniqueFallbackRows.push(l);
                    }
                    const finalFallbackRows = uniqueFallbackRows;
`;
content = content.replace(
`                    const fallbackRows = (fallback || []).filter((l) => !isManualInvoiceLead(l));`,
filterCode
);

const filterCode2 = `
                const dataRows = (data || []).filter((l) => !isManualInvoiceLead(l));
                
                // Filter duplicates
                const uniqueDataRows = [];
                const phoneMap2 = new Set();
                for (const l of dataRows) {
                    const phoneDigits = (l.phone || l.whatsapp_number || '').replace(/\\D/g, '').slice(-10);
                    if (phoneDigits && phoneDigits.length === 10) {
                        if (phoneMap2.has(phoneDigits)) continue;
                        phoneMap2.add(phoneDigits);
                    }
                    uniqueDataRows.push(l);
                }
                const finalDataRows = uniqueDataRows;
`;

content = content.replace(
`                const dataRows = (data || []).filter((l) => !isManualInvoiceLead(l));`,
filterCode2
);

content = content.replace(
`                    const legacyIds = fallbackRows`,
`                    const legacyIds = finalFallbackRows`
);

content = content.replace(
`                    setLeads(
                        fallbackRows.map((l) =>`,
`                    setLeads(
                        finalFallbackRows.map((l) =>`
);

content = content.replace(
`                setLeads(
                    dataRows.map((l) =>`,
`                setLeads(
                    finalDataRows.map((l) =>`
);

// Also make sure isExpanded specifically checks for true
content = content.replace(
`const isExpanded = expandedStages[col.title] || false;`,
`const isExpanded = expandedStages[col.title] === true;`
);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated CRM.tsx");
