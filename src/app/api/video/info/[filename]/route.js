import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { VIDEOS_DIR } from '@/lib/paths';

const execAsync = promisify(exec);

export async function GET(request, { params }) {
    try {
        const { filename } = await params;
        const filePath = path.join(VIDEOS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        const { stdout } = await execAsync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name -show_entries format=duration,size -of json "${filePath}"`
        );

        return NextResponse.json(JSON.parse(stdout));
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
