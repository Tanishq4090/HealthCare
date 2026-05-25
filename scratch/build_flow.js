import fs from 'node:fs';

const sourcePath = 'scripts/consent_form_flow.json';
const outputPath = 'scratch/consent_flow.json';

const flow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

fs.writeFileSync(outputPath, JSON.stringify(flow, null, 2));
