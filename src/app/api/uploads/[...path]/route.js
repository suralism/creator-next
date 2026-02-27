import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Serve static files from data directory
// This handles /api/uploads/audio/*, /api/uploads/images/*, /api/uploads/videos/*
export async function GET(request, { params }) {
    const { path: pathSegments } = await params;
    const filePath = path.join(process.cwd(), 'data', ...pathSegments);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const file = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mp3',
        '.mp4': 'video/mp4',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new Response(file, {
        headers: {
            'Content-Type': contentType,
            'Content-Length': file.length.toString(),
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
