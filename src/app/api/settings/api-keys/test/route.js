import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSettings } from '@/lib/settings';

// POST /api/settings/api-keys/test
export async function POST(request) {
    const { key, id } = await request.json();
    let keyToTest = key;

    if (id) {
        const settings = await getSettings();
        const found = settings.apiKeys.find(k => k.id === id);
        if (found) {
            keyToTest = found.key;
        } else {
            return NextResponse.json({ error: 'ไม่พบ API Key นี้' }, { status: 404 });
        }
    }

    if (!keyToTest) {
        return NextResponse.json({ error: 'กรุณาใส่ API Key' }, { status: 400 });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: keyToTest });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ตอบว่า "OK" แค่คำเดียว',
        });

        const text = response.text;

        return NextResponse.json({ success: true, message: `API Key ใช้งานได้! Response: ${text.substring(0, 50)}` });
    } catch (err) {
        return NextResponse.json({ success: false, message: `API Key ใช้งานไม่ได้: ${err.message}` });
    }
}
