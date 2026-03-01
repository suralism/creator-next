import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getActiveKey } from '@/lib/settings';
import { AUDIO_DIR } from '@/lib/paths';

const execAsync = promisify(exec);

function createWavHeader(pcmDataLength, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmDataLength;
    const headerSize = 44;
    const fileSize = headerSize + dataSize - 8;

    const header = Buffer.alloc(headerSize);
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return header;
}

function segmentText(text, maxChars = 2000) {
    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += sentence;
    }
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

export async function POST(request) {
    try {
        const { text, voice, emotion, projectId } = await request.json();

        const apiKey = await getActiveKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'กรุณาตั้งค่า API Key ในหน้าตั้งค่า (Settings)' }, { status: 400 });
        }

        if (!text || text.trim().length === 0) {
            return NextResponse.json({ error: 'กรุณาใส่ข้อความที่ต้องการแปลงเป็นเสียง' }, { status: 400 });
        }

        const ai = new GoogleGenAI({ apiKey });

        const audioId = uuidv4();
        const finalFileName = `${projectId || 'standalone'}_${audioId}.wav`;
        const finalFilePath = path.join(AUDIO_DIR, finalFileName);

        const chunks = segmentText(text, 2500);
        console.log(`TTS generation: Text split into ${chunks.length} chunks.`);

        const chunkFiles = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i].replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
            if (!chunkText) continue;

            console.log(`Generating TTS chunk ${i + 1}/${chunks.length}... (Emotion: ${emotion || 'neutral'})`);

            // Give hint to model to adapt tone
            let promptWithEmotion = chunkText;
            if (emotion && emotion !== 'neutral') {
                const emotionPrompts = {
                    'happy': 'Speak the following text with a very happy, cheerful, and energetic tone: ',
                    'sad': 'Speak the following text with a very sad, melancholic, and deeply emotional tone: ',
                    'angry': 'Speak the following text with an angry, aggressive, and frustrated tone: ',
                    'fearful': 'Speak the following text with a fearful, terrified, and scared tone: ',
                    'surprised': 'Speak the following text with a very surprised, shocked, and excited tone: ',
                    'drama': 'Speak the following text with a highly dramatic, intense, and captivating storytelling tone: ',
                    'calm': 'Speak the following text with a very calm, peaceful, soothing, and relaxing tone, like a meditation guide or Dharma talk: ',
                    'professional': 'Speak the following text with a confident, professional, clear, and authoritative business presentation tone: ',
                    'serious': 'Speak the following text with a very serious, dramatic, and formal tone: '
                };
                promptWithEmotion = `${emotionPrompts[emotion] || ''}${chunkText}`;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{ parts: [{ text: promptWithEmotion }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voice || 'Kore',
                            },
                        },
                    },
                },
            });

            const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (!audioData) {
                throw new Error(`Failed to generate TTS for chunk ${i + 1}`);
            }

            const pcmBuffer = Buffer.from(audioData.data, 'base64');
            const mimeType = audioData.mimeType || 'audio/L16;rate=24000';

            let sampleRate = 24000;
            const rateMatch = mimeType.match(/rate=(\d+)/);
            if (rateMatch) {
                sampleRate = parseInt(rateMatch[1]);
            }

            const wavHeader = createWavHeader(pcmBuffer.length, sampleRate);
            const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

            const chunkFileName = `temp_${audioId}_chunk_${i}.wav`;
            const chunkFilePath = path.join(AUDIO_DIR, chunkFileName);
            fs.writeFileSync(chunkFilePath, wavBuffer);
            chunkFiles.push(chunkFilePath);

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (chunkFiles.length > 1) {
            console.log(`Merging ${chunkFiles.length} TTS chunks into final file...`);
            const concatTxtPath = path.join(AUDIO_DIR, `concat_${audioId}.txt`);
            const concatContent = chunkFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
            fs.writeFileSync(concatTxtPath, concatContent);

            const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatTxtPath}" -c copy "${finalFilePath}"`;
            await execAsync(ffmpegCmd);

            fs.unlinkSync(concatTxtPath);
            chunkFiles.forEach(f => fs.unlinkSync(f));
        } else {
            fs.renameSync(chunkFiles[0], finalFilePath);
        }

        const stats = fs.statSync(finalFilePath);
        console.log(`TTS generated successfully: ${finalFileName}`);

        return NextResponse.json({
            success: true,
            audioId,
            fileName: finalFileName,
            filePath: `/api/uploads/audio/${finalFileName}`,
            mimeType: 'audio/wav',
            size: stats.size
        });
    } catch (err) {
        console.error('TTS Error:', err);
        return NextResponse.json({ error: `TTS Error: ${err.message}` }, { status: 500 });
    }
}
