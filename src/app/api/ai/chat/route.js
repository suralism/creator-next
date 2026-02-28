import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getActiveKey } from '@/lib/settings';

export async function POST(request) {
    try {
        const { message, context } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `${context ? `Context: ${context}\n\n` : ''}${message}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return NextResponse.json({ reply: response.text });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
