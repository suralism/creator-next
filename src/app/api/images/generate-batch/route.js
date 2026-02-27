import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getActiveKey } from '@/lib/settings';
import { IMAGES_DIR } from '@/lib/paths';

export async function POST(request) {
    try {
        const { prompts, projectId, style, aspectRatio, scriptContext } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        if (!Array.isArray(prompts) || prompts.length === 0) {
            return NextResponse.json({ error: 'กรุณาใส่ prompts เป็น array' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });
        const results = [];

        for (const prompt of prompts) {
            try {
                const strictNoText = "absolutely NO text, NO watermarks, NO letters, NO words, NO subtitles, NO typography, clear image";
                let enhancedPrompt = `${prompt}`;
                if (style) enhancedPrompt += `, style: ${style}`;
                enhancedPrompt += `, high quality, detailed, cinematic lighting, ${strictNoText}`;

                if (scriptContext && scriptContext.length > 0) {
                    const briefContext = scriptContext.substring(0, 300);
                    enhancedPrompt += `\n\nThis image is an illustration for a video with the following script context: "${briefContext}"`;
                }

                console.log(`Generating image (${aspectRatio || '9:16'}): ${prompt.substring(0, 80)}...`);

                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-image-preview',
                    contents: enhancedPrompt,
                    config: {
                        responseModalities: ['image', 'text'],
                        imageConfig: {
                            aspectRatio: aspectRatio || '9:16',
                        },
                    },
                });

                const parts = response.candidates?.[0]?.content?.parts || [];
                const imagePart = parts.find(p => p.inlineData);

                if (imagePart) {
                    const imageId = uuidv4();
                    const ext = imagePart.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
                    const fileName = `${projectId || 'standalone'}_${imageId}.${ext}`;
                    const filePath = path.join(IMAGES_DIR, fileName);

                    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
                    fs.writeFileSync(filePath, imageBuffer);

                    results.push({
                        success: true,
                        prompt,
                        imageId,
                        fileName,
                        filePath: `/api/uploads/images/${fileName}`,
                        size: imageBuffer.length
                    });
                } else {
                    results.push({ success: false, prompt, error: 'ไม่สามารถสร้างรูปภาพได้' });
                }
            } catch (err) {
                console.error(`Image gen error for "${prompt.substring(0, 50)}":`, err.message);
                results.push({ success: false, prompt, error: err.message });
            }
        }

        return NextResponse.json({ results });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
