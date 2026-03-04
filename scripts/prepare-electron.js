const fs = require('fs');
const path = require('path');

const srcPublic = path.join(__dirname, '../public');
const destPublic = path.join(__dirname, '../.next/standalone/public');

const srcStatic = path.join(__dirname, '../.next/static');
const destStatic = path.join(__dirname, '../.next/standalone/.next/static');

function copyDirIterative(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirIterative(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('--- Preparing Electron standalone Build ---');

if (fs.existsSync(srcPublic)) {
    console.log('Copying /public to standalone/public...');
    copyDirIterative(srcPublic, destPublic);
} else {
    console.log('Warning: /public not found.');
}

if (fs.existsSync(srcStatic)) {
    console.log('Copying /.next/static to standalone/.next/static...');
    copyDirIterative(srcStatic, destStatic);
} else {
    console.log('Warning: /.next/static not found.');
}

console.log('Done preparing.');
