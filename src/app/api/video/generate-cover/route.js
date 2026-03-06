import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getActiveKey } from '@/lib/settings';
import { ROOT_DIR, IMAGES_DIR } from '@/lib/paths';

export async function POST(request) {
    try {
        const { projectName, aiAnalysis, aspectRatio, projectId } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });
        let activeTitleText = projectName || 'Untitled';

        // 1. Analyze Title Hook
        if (aiAnalysis) {
            try {
                const titlePrompt = `Generate a very catchy, short, high-engagement "Hook" title for a Thai social media video (TikTok/Shorts).
Project Topic: "${projectName}"
Rules:
1. Results must be in THAI language.
2. 3-8 words maximum.
3. Use strong emotional triggers or curiosity.
4. Include 1-2 relevant emojis.
5. Give me ONLY the title text, nothing else.`;

                const titleRes = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-lite-preview',
                    contents: titlePrompt
                });
                if (titleRes.response) {
                    const hookText = titleRes.response.text().trim();
                    if (hookText) activeTitleText = hookText;
                }
            } catch (e) {
                console.error('Title hook preview failed:', e);
            }
        }

        // 2. Generate Cover Image
        console.log('Generating Preview AI Cover Image...');
        const coverPrompt = `A premium, cinematic social media cover image (no people or faces, focused on aesthetics).
The image MUST HAVE this exact THAI text title clearly and beautifully rendered in the center with modern typography: "${activeTitleText}".
Style: Cinematic, high contrast, vibrant colors, premium quality, clear text rendering.
Context: ${projectName}.
Aspect Ratio: ${aspectRatio || '9:16'}`;

        const coverRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: coverPrompt,
            config: {
                responseModalities: ['image', 'text'],
                imageConfig: { aspectRatio: aspectRatio || '9:16' }
            }
        });

        const parts = coverRes.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);
        if (imagePart) {
            const coverId = uuidv4();
            const fileName = `preview_cover_${projectId || 'video'}_${coverId}.jpg`;
            const filePath = path.join(IMAGES_DIR, fileName);
            const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
            fs.writeFileSync(filePath, imageBuffer);

            return NextResponse.json({
                success: true,
                hookText: activeTitleText,
                fileName,
                filePath: `/api/uploads/images/${fileName}`
            });
        } else {
            throw new Error('ไม่สามารถสร้างรูปภาพหน้าปกได้');
        }
    } catch (err) {
        console.error('Cover Preview Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
