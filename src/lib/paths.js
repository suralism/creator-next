import path from 'path';
import fs from 'fs';

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const AUDIO_DIR = path.join(DATA_DIR, 'audio');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

// Ensure data directories exist
const dataDirs = [
    'data/projects', 'data/audio', 'data/images', 'data/videos', 'data/exports'
];

dataDirs.forEach(dir => {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});
