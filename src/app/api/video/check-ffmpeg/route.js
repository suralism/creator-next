import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const { stdout } = await execAsync('ffmpeg -version');
        const version = stdout.split('\n')[0];
        return NextResponse.json({ available: true, version });
    } catch {
        return NextResponse.json({ available: false, version: null });
    }
}
