const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const targetDir = path.resolve('src/features/dtf-factory');
if (!fs.existsSync(targetDir)) {
    console.error('Directory not found:', targetDir);
    process.exit(1);
}

const files = walk(targetDir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content
        .replace(/from ['"]@\//g, "from '@dtf/")
        .replace(/import ['"]@\//g, "import '@dtf/")
        .replace(/require\(['"]@\//g, "require('@dtf/")
        .replace(/import { (.+) } from ['"]next\/font\/google['"]/g, "// import { $1 } from 'next/font/google'") // Comentar fontes next
        .replace(/import Image from ['"]next\/image['"]/g, "import { Image } from 'lucide-react'") // Temporário ou remover
        .replace(/'use client';/g, '') // Remover diretiva next
        .replace(/"use client";/g, ''); 

    // Ajustes específicos para next/dynamic -> React.lazy
    // Isso é complexo, melhor fazer manual se falhar. Mas o replace básico de imports ajuda muito.

    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Updated imports in ${file}`);
    }
});
