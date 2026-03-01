import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BGM_DIR } from '@/lib/paths';

// DELETE /api/bgm/[id]
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const metaPath = path.join(BGM_DIR, '_meta.json');

        if (!fs.existsSync(metaPath)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        let meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const entry = meta.find(m => m.id === id);

        if (!entry) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Delete the actual file
        const filePath = path.join(BGM_DIR, entry.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Update meta
        meta = meta.filter(m => m.id !== id);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
