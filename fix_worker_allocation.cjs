const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/components/hr/WorkerAllocation.tsx';
let content = fs.readFileSync(file, 'utf8');

// The DialogContent wraps the form. I want to add max-h-[85vh] and overflow-y-auto to the DialogContent OR the form wrapper.
const target = `<DialogContent className="max-w-md">`;
const replacement = `<DialogContent className="max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar">`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log("Success");
