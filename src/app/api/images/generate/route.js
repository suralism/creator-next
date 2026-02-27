import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getActiveKey } from '@/lib/settings';
import { IMAGES_DIR } from '@/lib/paths';

export async function POST(request) {
    try {
        const { prompt, projectId, style, aspectRatio } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        if (!prompt || prompt.trim().length === 0) {
            return NextResponse.json({ error: 'กรุณาใส่คำอธิบายภาพ' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const strictNoText = "absolutely NO text, NO watermarks, NO letters, NO words, NO subtitles, NO typography, clear image";
        const enhancedPrompt = style
            ? `${prompt}, style: ${style}, high quality, detailed, ${strictNoText}`
            : `${prompt}, high quality, detailed, professional, ${strictNoText}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: enhancedPrompt,
            config: {
                responseModalities: ['image', 'text'],
                imageConfig: {
                    aspectRatio: aspectRatio || '1:1',
                },
            },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);

        if (!imagePart) {
            return NextResponse.json({ error: 'ไม่สามารถสร้างรูปภาพได้ กรุณาลองใหม่' }, { status: 500 });
        }

        const imageId = uuidv4();
        const ext = imagePart.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
        const fileName = `${projectId || 'standalone'}_${imageId}.${ext}`;
        const filePath = path.join(IMAGES_DIR, fileName);

        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        fs.writeFileSync(filePath, imageBuffer);

        return NextResponse.json({
            success: true,
            imageId,
            fileName,
            filePath: `/api/uploads/images/${fileName}`,
            mimeType: imagePart.inlineData.mimeType,
            size: imageBuffer.length
        });
    } catch (err) {
        console.error('Image Generation Error:', err);
        return NextResponse.json({ error: `Image Error: ${err.message}` }, { status: 500 });
    }
}
