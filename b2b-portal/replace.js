const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            results.push(file);
        }
    });
    return results;
}

const files = walk(__dirname + '/src').filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

let totalReplacements = 0;
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('/b2b/')) {
        const newContent = content.replace(/\/b2b\//g, '/');
        fs.writeFileSync(file, newContent);
        totalReplacements++;
        console.log(`Updated ${file}`);
    }
}
console.log(`Total files updated: ${totalReplacements}`);
