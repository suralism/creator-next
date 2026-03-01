import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getActiveKey } from '@/lib/settings';

export async function POST(request) {
    try {
        const { category, count, platform, language } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const platformGuide = {
            youtube_shorts: 'YouTube Shorts (วิดีโอสั้น 30-60 วินาที)',
            podcast: 'Podcast (เนื้อหา 3-10 นาที)',
            tiktok: 'TikTok (วิดีโอสั้น 15-60 วินาที)',
            reels: 'Instagram Reels (วิดีโอสั้น 30-90 วินาที)'
        };

        const prompt = `คุณเป็นนักวางแผนคอนเทนต์มืออาชีพ กรุณาคิดหัวข้อคอนเทนต์ ${count} หัวข้อ
สำหรับหมวดหมู่: "${category}"
แพลตฟอร์ม: ${platformGuide[platform] || platform}
ภาษา: ${language === 'th' ? 'ไทย' : 'English'}

กรุณาคิดหัวข้อที่:
- น่าสนใจ ดึงดูด มีคนอยากดู
- หลากหลาย ไม่ซ้ำกัน
- เหมาะกับแพลตฟอร์มที่กำหนด
- ทันสมัย เป็นที่นิยม

ตอบกลับเป็น JSON array เท่านั้น:
[
  { "name": "ชื่อโปรเจค (สั้น กระชับ)", "description": "คำอธิบายหัวข้อ 1-2 ประโยค" },
  ...
]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let text = response.text;
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let topics;
        try {
            topics = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'AI ไม่สามารถสร้างหัวข้อได้ ลองใหม่อีกครั้ง' }, { status: 500 });
        }

        return NextResponse.json({ topics });
    } catch (err) {
        console.error('Generate Topics Error:', err);
        return NextResponse.json({ error: `AI Error: ${err.message}` }, { status: 500 });
    }
}
