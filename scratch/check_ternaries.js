const fs = require('fs');
const content = fs.readFileSync('/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/CRM.tsx', 'utf8');

let lines = content.split('\n');
let ternaryCount = 0;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Simple check for ? followed by ( or a newline or space, ignoring typical optional chaining and types
    // This is hard to do with regex alone but let's try.
    // Instead, let's look for ? that have matching : in the same line, and then look for those that don't.
    let countQ = (line.match(/\?/g) || []).length;
    let countC = (line.match(/:/g) || []).length;
    
    // This is too simplistic. Let's just output every line with a ? that doesn't have a : on the same line.
    if (countQ > 0 && countC === 0) {
        console.log(`Line ${i+1}: ${line.trim()}`);
    }
}
