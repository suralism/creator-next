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
            youtube_doc: 'YouTube Documentary (สารคดีสั้นกระชับฉับไว 3-15 นาที แนวนอน 16:9 เน้นเล่าเรื่องในเชิงสารคดี ข้อมูลเจาะลึก จังหวะฉับไว)',
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

        // Style-specific extra instructions
        const styleGuide = {
            documentary: `
🎬 สไตล์: สารคดีกระชับฉับไว (YouTube Documentary Style)
- เขียนเหมือนบทสารคดีที่เล่าเรื่องด้วยจังหวะเร็ว กระชับ ตัดฉากไว ไม่น้ำ ไม่อ้อมค้อม
- เปิดเรื่องด้วยข้อเท็จจริงที่น่าตกใจ คำถามชวนคิด หรือสถานการณ์ที่ดึงดูดทันที
- ใช้ประโยคสั้น กระชับ มีพลัง ห้ามประโยคยาวเกิน 2 บรรทัด
- ใส่ข้อมูลจริง ตัวเลขจริง สถิติ ข้อเท็จจริงที่น่าสนใจ เหมือนสารคดี Netflix หรือ Vox
- สร้างจังหวะเหมือนวิดีโอ: แต่ละย่อหน้าเปรียบเสมือนฉากใหม่ มี "ตัดภาพ" ไปเรื่องใหม่
- มีจุดพีคหรือ twist ในเนื้อหาที่ทำให้คนดูตื่นเต้น
- ทุกย่อหน้าต้องมีข้อมูลใหม่ ห้ามย้ำซ้ำ ห้ามพูดวน
- จบด้วยบทสรุปที่ทิ้งคำถามหรือข้อคิดให้คนดูไปคิดต่อ`,
        };

        const styleExtra = styleGuide[style] || '';
        const styleText = styleExtra || `สไตล์: ${style || 'ให้ความรู้ สนุก น่าสนใจ'}`;

        const prompt = `คุณเป็นนักเขียนบทคอนเทนต์มืออาชีพ สร้างบทสำหรับ ${platformGuide[platform] || platform}

หัวข้อ: ${topic}
ภาษา: ${language === 'th' ? 'ไทย' : language === 'en' ? 'English' : language}
${styleText}

🎭 เพศผู้พูด: ${genderInstruction}

⚠️ สำคัญมาก - ความยาวบท: ${durationText}
- บทพูดต้องมีความยาวเหมาะสมกับเวลาที่กำหนด
- อัตราการพูดคนไทยประมาณ 150-200 คำ/นาที ภาษาอังกฤษประมาณ 130-170 คำ/นาที
- เขียนให้ครบตามจำนวนคำที่ระบุ ห้ามเขียนสั้นกว่านี้
- ถ้าเป็นเนื้อหายาว ให้แบ่งเป็นหลายย่อหน้า มีการเปลี่ยนประเด็น เปลี่ยนมุมมอง

📝 โครงสร้างบทพูด (ต้องมีครบทุกส่วน):
- **เปิดเรื่อง (Hook)**: ดึงดูดความสนใจใน 1-2 ประโยคแรก ชวนให้อยากฟังต่อ
- **เนื้อหา (Body)**: อธิบายประเด็นหลัก ใส่ข้อมูล ตัวอย่าง หรือเรื่องเล่า
- **ปิดท้าย (Conclusion)**: สรุปใจความสำคัญ + จบด้วย call-to-action หรือข้อคิดที่ประทับใจ ห้ามจบห้วน ต้องจบแบบมีความรู้สึกสมบูรณ์ ผู้ฟังรู้สึกว่าเรื่องจบลงอย่างดี

กรุณาสร้าง:
1. ชื่อคอนเทนต์ที่ดึงดูด (title)
2. บทพูด (script) - เขียนเป็นบทพูดที่พร้อมอ่านออกเสียง **ห้ามใส่เครื่องหมายวงเล็บ () หรือ [] โดยเด็ดขาด ห้ามใส่คำอธิบายภาพ ห้ามมี stage direction ห้ามมีอารมณ์ในวงเล็บเด็ดขาด** เขียนเฉพาะตัวหนังสือที่จะให้อ่านออกเสียงเท่านั้น ความยาวต้องตรงกับ ${durationText} ต้องมีบทปิดท้ายที่สมบูรณ์เสมอ
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
            model: 'gemini-3.1-flash-lite-preview',
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
