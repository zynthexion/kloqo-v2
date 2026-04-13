const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./apps');
const regex = /from\s+['"]([^'"]*lib\/types|[^'"]*\/types)['"]/g;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let hasChanges = false;
    
    // Check if there are any matches
    if (regex.test(content)) {
        content = content.replace(regex, "from '@kloqo/shared'");
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
});
