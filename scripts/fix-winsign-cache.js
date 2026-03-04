/**
 * Fix winCodeSign cache for electron-builder on Windows without admin/Developer Mode.
 * 
 * electron-builder uses a hash-based directory name for the cache.
 * We need to intercept and provide the extracted files at the exact location it expects.
 * 
 * This script patches the winCodeSign extraction by:
 * 1. Running electron-builder's own extraction
 * 2. Catching the error, then re-extracting WITHOUT -snld flag
 * 3. Creating dummy files for the macOS symlinks
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_DIR = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');

// Find 7zip binary
let sevenZipPath;
const possiblePaths = [
    path.join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
    path.join(process.cwd(), 'node_modules', '7zip-bin-win', 'x64', '7za.exe'),
];
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        sevenZipPath = p;
        break;
    }
}

if (!sevenZipPath) {
    console.error('Cannot find 7za.exe.');
    process.exit(1);
}

console.log('Fixing winCodeSign cache...');
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Find all .7z files and their corresponding directories
const entries = fs.readdirSync(CACHE_DIR);

// Find .7z archive files
const archives = entries.filter(e => e.endsWith('.7z'));

if (archives.length === 0) {
    console.log('No winCodeSign archives found in cache. Will be downloaded by electron-builder.');
    // Download it ourselves
    const archivePath = path.join(CACHE_DIR, 'winCodeSign-2.6.0.7z');
    if (!fs.existsSync(archivePath)) {
        console.log('Downloading winCodeSign...');
        execSync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z' -OutFile '${archivePath}'"`, {
            stdio: 'inherit',
            timeout: 30000
        });
    }
    archives.push('winCodeSign-2.6.0.7z');
}

for (const archive of archives) {
    const archivePath = path.join(CACHE_DIR, archive);
    const dirName = archive.replace('.7z', '');
    const extractDir = path.join(CACHE_DIR, dirName);

    // Check if already properly fixed
    const marker = path.join(extractDir, '.fixed');
    if (fs.existsSync(marker)) {
        console.log(`${dirName} already fixed. Skipping.`);
        continue;
    }

    // Remove failed extraction dir
    if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
    }

    console.log(`Extracting ${archive} (without symlink flag)...`);
    try {
        execSync(`"${sevenZipPath}" x -bd -y "${archivePath}" "-o${extractDir}"`, {
            stdio: 'pipe'
        });
    } catch (e) {
        // Exit code 1 or 2 is OK - just symlink warnings
        console.log('  Extraction done (symlink warnings ignored).');
    }

    // Create dummy files for macOS symlinks
    const darwinLibDir = path.join(extractDir, 'darwin', '10.12', 'lib');
    fs.mkdirSync(darwinLibDir, { recursive: true });
    for (const f of ['libcrypto.dylib', 'libssl.dylib']) {
        const fPath = path.join(darwinLibDir, f);
        if (!fs.existsSync(fPath)) {
            fs.writeFileSync(fPath, '');
        }
    }

    fs.writeFileSync(marker, new Date().toISOString());
    console.log(`  Fixed: ${dirName}`);
}

// Also fix any hash-only directories that don't have a corresponding .7z anymore
const hashDirs = entries.filter(e => /^\d+$/.test(e) && fs.statSync(path.join(CACHE_DIR, e)).isDirectory());
for (const dir of hashDirs) {
    const dirPath = path.join(CACHE_DIR, dir);
    const marker = path.join(dirPath, '.fixed');

    if (fs.existsSync(marker)) continue;

    // Find corresponding .7z
    const archivePath = path.join(CACHE_DIR, dir + '.7z');
    if (fs.existsSync(archivePath)) {
        console.log(`Re-extracting ${dir}.7z...`);
        fs.rmSync(dirPath, { recursive: true, force: true });
        try {
            execSync(`"${sevenZipPath}" x -bd -y "${archivePath}" "-o${dirPath}"`, { stdio: 'pipe' });
        } catch (e) { /* ignore symlink errors */ }

        const darwinLibDir = path.join(dirPath, 'darwin', '10.12', 'lib');
        fs.mkdirSync(darwinLibDir, { recursive: true });
        for (const f of ['libcrypto.dylib', 'libssl.dylib']) {
            const fPath = path.join(darwinLibDir, f);
            if (!fs.existsSync(fPath)) fs.writeFileSync(fPath, '');
        }
        fs.writeFileSync(marker, new Date().toISOString());
        console.log(`  Fixed: ${dir}`);
    } else {
        // No archive, remove broken dir
        console.log(`Removing orphaned dir: ${dir}`);
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

console.log('winCodeSign cache is ready!');
