const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function processFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/parseDateFns\(([^,]+),\s*["']hh:mm a["'],\s*([^)]+)\)/g, 'parseTime($1, $2)');
    content = content.replace(/parse\(([^,]+),\s*["']hh:mm a["'],\s*([^)]+)\)/g, 'parseTime($1, $2)');
    content = content.replace(/parse\(([^,]+),\s*["']HH:mm["'],\s*([^)]+)\)/g, 'parseTime($1, $2)');
    
    if (content !== original) {
        content = content.replace(/import \{ cn, parseTime as parseTimeUtil \} from "@\/lib\/utils";/g, 'import { cn, parseTime } from "@/lib/utils";');
        content = content.replace(/parseTimeUtil\(/g, 'parseTime(');
        
        // Add import if missing
        if (!content.includes('parseTime') && content.includes('@/lib/utils')) {
             content = content.replace(/(import\s+\{)([^}]*)(\}\s+from\s+["']@\/lib\/utils["'])/g, (match, p1, p2, p3) => {
                 if(p2.includes('parseTime')) return match;
                 return `${p1} ${p2.trim()}, parseTime ${p3}`;
             });
        }
        
        fs.writeFileSync(filePath, content);
        console.log("Updated: " + filePath);
    }
}

walkDir('/Users/jinodevasia/Desktop/Kloqo-Production copy/kloqo-v2/apps', processFile);
