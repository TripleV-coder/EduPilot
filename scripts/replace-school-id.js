const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir('./src/app/api', (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if it doesn't contain session.user.schoolId
    if (!content.includes('session.user.schoolId')) return;

    // We replace session.user.schoolId with getActiveSchoolId(session)
    // Careful with assignment: session.user.schoolId = ... we don't want to replace that, but in /api it's rare.
    // Let's use regex to only replace when it's not followed by "="
    const regex = /session\.user\.schoolId(?!\s*=)/g;
    
    if (!regex.test(content)) return;
    
    let modified = content.replace(regex, 'getActiveSchoolId(session)');

    // Add import if not present
    if (!modified.includes('getActiveSchoolId')) {
        return; // shouldn't happen since we just replaced it
    }

    if (!content.includes('getActiveSchoolId')) {
        // Find the last import statement or the beginning of the file
        const importRegex = /import\s+.*?;?\n/g;
        let lastMatch = null;
        let match;
        while ((match = importRegex.exec(modified)) !== null) {
            lastMatch = match;
        }

        const importStatement = `import { getActiveSchoolId } from "@/lib/api/tenant-isolation";\n`;
        
        if (lastMatch) {
            const insertIndex = lastMatch.index + lastMatch[0].length;
            modified = modified.slice(0, insertIndex) + importStatement + modified.slice(insertIndex);
        } else {
            modified = importStatement + modified;
        }
    }

    fs.writeFileSync(filePath, modified, 'utf8');
    console.log('Updated', filePath);
});
