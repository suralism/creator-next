import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { IMAGES_DIR } from '@/lib/paths';

export async function GET() {
    try {
        const files = fs.readdirSync(IMAGES_DIR)
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .map(f => {
                const stats = fs.statSync(path.join(IMAGES_DIR, f));
                return {
                    fileName: f,
                    filePath: `/api/uploads/images/${f}`,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            });
        return NextResponse.json(files);
    } catch (err) {
        return NextResponse.json([]);
    }
}
