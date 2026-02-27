import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getActiveKey } from '@/lib/settings';

export async function POST(request) {
    try {
        const { message, context } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `${context ? `Context: ${context}\n\n` : ''}${message}`;
        const result = await model.generateContent(prompt);
        const response = result.response;

        return NextResponse.json({ reply: response.text() });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
