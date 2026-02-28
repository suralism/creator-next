import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getActiveKey } from '@/lib/settings';

export async function POST(request) {
    try {
        const { topic, platform, language, style, duration, gender } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const platformGuide = {
            youtube_shorts: 'YouTube Shorts (วิดีโอสั้น 30-60 วินาที แนวตั้ง, ดึงดูดใน 3 วินาทีแรก)',
            podcast: 'Podcast (เนื้อหา 3-10 นาที, เป็นบทสนทนาหรือเล่าเรื่อง)',
            tiktok: 'TikTok (วิดีโอสั้น 15-60 วินาที, เทรนด์)',
            reels: 'Instagram Reels (วิดีโอสั้น 30-90 วินาที)'
        };

        const durationText = duration || '1 นาที (ประมาณ 150-200 คำ)';

        const genderGuide = {
            male: 'ผู้พูดเป็นเพศชาย — ใช้คำลงท้ายว่า "ครับ" และใช้สรรพนาม "ผม" เท่านั้น ห้ามใช้ "ค่ะ/คะ/ดิฉัน/หนู" เด็ดขาด',
            female: 'ผู้พูดเป็นเพศหญิง — ใช้คำลงท้ายว่า "ค่ะ" (บอกเล่า) หรือ "คะ" (คำถาม) และใช้สรรพนาม "ดิฉัน" หรือ "หนู" ห้ามใช้ "ครับ/ผม" เด็ดขาด',
            neutral: 'ไม่ต้องใช้คำลงท้ายที่ระบุเพศ (ไม่ต้องใช้ ครับ/ค่ะ/คะ) และไม่ต้องใช้สรรพนามที่ระบุเพศ เขียนเป็นกลางๆ'
        };
        const genderInstruction = genderGuide[gender] || genderGuide.neutral;

        const prompt = `คุณเป็นนักเขียนบทคอนเทนต์มืออาชีพ สร้างบทสำหรับ ${platformGuide[platform] || platform}

หัวข้อ: ${topic}
ภาษา: ${language === 'th' ? 'ไทย' : language === 'en' ? 'English' : language}
สไตล์: ${style || 'ให้ความรู้ สนุก น่าสนใจ'}

🎭 เพศผู้พูด: ${genderInstruction}

⚠️ สำคัญมาก - ความยาวบท: ${durationText}
- บทพูดต้องมีความยาวเหมาะสมกับเวลาที่กำหนด
- อัตราการพูดคนไทยประมาณ 150-200 คำ/นาที ภาษาอังกฤษประมาณ 130-170 คำ/นาที
- เขียนให้ครบตามจำนวนคำที่ระบุ ห้ามเขียนสั้นกว่านี้
- ถ้าเป็นเนื้อหายาว ให้แบ่งเป็นหลายย่อหน้า มีการเปลี่ยนประเด็น เปลี่ยนมุมมอง

กรุณาสร้าง:
1. ชื่อคอนเทนต์ที่ดึงดูด (title)
2. บทพูด (script) - เขียนเป็นบทพูดที่พร้อมอ่านออกเสียง **ห้ามใส่เครื่องหมายวงเล็บ () หรือ [] โดยเด็ดขาด ห้ามใส่คำอธิบายภาพ ห้ามมี stage direction ห้ามมีอารมณ์ในวงเล็บเด็ดขาด** เขียนเฉพาะตัวหนังสือที่จะให้อ่านออกเสียงเท่านั้น ความยาวต้องตรงกับ ${durationText}
3. คำอธิบาย (description) - สำหรับใช้เป็น caption
4. แฮชแท็ก (hashtags) - 5-10 แฮชแท็กที่เกี่ยวข้อง
5. คำแนะนำภาพประกอบ (imagePrompts) - อาร์เรย์ของ prompt สำหรับสร้างภาพ 3-5 ภาพ เขียนเป็นภาษาอังกฤษ **สำคัญ: ทุกภาพที่มีคนต้องระบุว่าเป็นคนไทยหรือเอเชียตะวันออกเฉียงใต้ มีลักษณะหน้าตาแบบเอเชีย ฉากหลังและบรรยากาศต้องเป็นแบบเอเชีย/ไทย ห้ามใช้คนตะวันตกเด็ดขาด**

ตอบกลับเป็น JSON format:
{
  "title": "...",
  "script": "...",
  "description": "...",
  "hashtags": ["...", "..."],
  "imagePrompts": ["...", "..."]
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let text = response.text;

        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = {
                title: topic,
                script: text,
                description: '',
                hashtags: [],
                imagePrompts: []
            };
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error('AI Generation Error:', err);
        return NextResponse.json({ error: `AI Error: ${err.message}` }, { status: 500 });
    }
}
