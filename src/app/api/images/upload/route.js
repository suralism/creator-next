import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// POST /api/images/upload — Upload custom images/videos for a project
export async function POST(request) {
    try {
        const formData = await request.formData();
        const projectId = formData.get('projectId');
        const files = formData.getAll('files');

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const projectDir = path.join(process.cwd(), 'data', 'images', projectId);
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        const results = [];

        for (const file of files) {
            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                const ext = path.extname(file.name).toLowerCase() || '.png';
                const baseName = path.basename(file.name, ext);
                const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
                const timestamp = Date.now();
                const fileName = `upload_${safeName}_${timestamp}${ext}`;
                const filePath = path.join(projectDir, fileName);

                fs.writeFileSync(filePath, buffer);

                const servePath = `/api/uploads/images/${projectId}/${fileName}`;
                results.push({
                    success: true,
                    fileName: file.name,
                    filePath: servePath,
                    type: file.type,
                    size: buffer.length
                });
            } catch (err) {
                results.push({
                    success: false,
                    fileName: file.name,
                    error: err.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            results,
            uploaded: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });
    } catch (err) {
        console.error('Upload error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
