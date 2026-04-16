const fs = require('fs');
const content = fs.readFileSync('/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/CRM.tsx', 'utf8');

let curly = 0;
let paren = 0;
let brace = 0; // [ ]
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let char of line) {
        if (char === '{') curly++;
        if (char === '}') curly--;
        if (char === '(') paren++;
        if (char === ')') paren--;
        if (char === '[') brace++;
        if (char === ']') brace--;
    }
    if (curly < 0 || paren < 0 || brace < 0) {
        console.log(`IMBALANCED at line ${i + 1}: curly=${curly}, paren=${paren}, brace=${brace}`);
        break;
    }
}
console.log(`FINAL: curly=${curly}, paren=${paren}, brace=${brace}`);
