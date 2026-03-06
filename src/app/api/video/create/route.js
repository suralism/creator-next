import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getActiveKey } from '@/lib/settings';
import { ROOT_DIR, VIDEOS_DIR, IMAGES_DIR } from '@/lib/paths';

const execAsync = promisify(exec);

function getAnimationFilter(type, index, duration, w, h) {
    const fps = 30;
    const d = Math.ceil(duration * fps);
    const zIn = `1.0+(0.3*(on/${d}))`;
    const zOut = `1.3-(0.3*(on/${d}))`;

    switch (type) {
        case 'kenburns': {
            const variants = [
                `zoompan=z='${zIn}':x='iw/2-(iw/zoom/2)+(on/${d})*(iw*0.15)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
                `zoompan=z='${zIn}':x='iw/2-(iw/zoom/2)-(on/${d})*(iw*0.12)':y='ih/2-(ih/zoom/2)+(on/${d})*(ih*0.06)':d=${d}:s=${w}x${h}:fps=${fps}`,
                `zoompan=z='${zOut}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
                `zoompan=z='${zIn}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+(on/${d})*(ih*0.12)':d=${d}:s=${w}x${h}:fps=${fps}`,
                `zoompan=z='${zIn}':x='iw/2-(iw/zoom/2)+(on/${d})*(iw*0.1)':y='ih/2-(ih/zoom/2)-(on/${d})*(ih*0.08)':d=${d}:s=${w}x${h}:fps=${fps}`,
            ];
            return variants[index % variants.length];
        }
        case 'zoom_in':
            return `zoompan=z='${zIn}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`;
        case 'zoom_out':
            return `zoompan=z='${zOut}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`;
        case 'pan_lr': {
            if (index % 2 === 0) {
                return `zoompan=z='1.15':x='(iw*0.05)+(on/${d})*(iw*0.25)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`;
            } else {
                return `zoompan=z='1.15':x='(iw*0.30)-(on/${d})*(iw*0.25)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`;
            }
        }
        case 'pan_ud': {
            if (index % 2 === 0) {
                return `zoompan=z='1.15':x='iw/2-(iw/zoom/2)':y='(ih*0.05)+(on/${d})*(ih*0.25)':d=${d}:s=${w}x${h}:fps=${fps}`;
            } else {
                return `zoompan=z='1.15':x='iw/2-(iw/zoom/2)':y='(ih*0.30)-(on/${d})*(ih*0.25)':d=${d}:s=${w}x${h}:fps=${fps}`;
            }
        }
        case 'none':
            return `zoompan=z='1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`;
        default:
            return getRandomAnimation(index, duration, w, h);
    }
}

function getRandomAnimation(index, duration, w, h) {
    const types = ['kenburns', 'zoom_in', 'zoom_out', 'pan_lr', 'pan_ud'];
    const randomType = types[index % types.length];
    return getAnimationFilter(randomType, index, duration, w, h);
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Use AI to split Thai text into natural subtitle phrases
async function aiChunkText(text, apiKey) {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `แบ่งข้อความภาษาไทยนี้ออกเป็นวลีสั้นๆ สำหรับซับไตเติ้ล

กฎ:
- แต่ละบรรทัดต้องเป็นวลีที่สมบูรณ์ อ่านแล้วเข้าใจได้
- ไม่เกิน 5 คำต่อบรรทัด
- ห้ามตัดคำกลางคำ
- ตอบเป็นข้อความธรรมดา 1 วลีต่อ 1 บรรทัด
- ห้ามใส่หมายเลข ห้ามใส่เครื่องหมายใดๆ

ข้อความ:
${text.substring(0, 3000)}

ผลลัพธ์:`;

        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: prompt
        });

        let responseText = '';
        if (result && result.response && typeof result.response.text === 'function') {
            responseText = result.response.text();
        } else if (result && typeof result.text === 'string') {
            responseText = result.text;
        } else if (result && typeof result.text === 'function') {
            responseText = result.text();
        }

        if (responseText) {
            responseText = responseText.replace(/```[^`]*```/g, '').trim();
            const lines = responseText.split('\n')
                .map(l => l.replace(/^\d+[\.\)\-\s]+/, '').trim())
                .filter(l => l.length > 0 && l.length < 100);

            if (lines.length >= 3) {
                console.log('AI chunked text into ' + lines.length + ' phrases');
                return lines;
            }
        }
    } catch (e) {
        console.error('AI chunking failed:', e.message);
    }
    return null;
}

// Fallback: mechanical word-count based chunking
function mechanicalChunk(text) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const allTokens = [];
    for (const { segment, isWordLike } of segmenter.segment(text)) {
        allTokens.push({ text: segment, isWord: isWordLike });
    }

    const maxWords = 5;
    const chunks = [];
    let currentChunk = '';
    let wordCount = 0;

    for (const { text: t, isWord } of allTokens) {
        if (isWord && wordCount >= maxWords && currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = t;
            wordCount = 1;
        } else {
            currentChunk += t;
            if (isWord) wordCount++;
        }
    }
    if (currentChunk.trim()) {
        if (wordCount <= 1 && chunks.length > 0) {
            chunks[chunks.length - 1] += currentChunk;
        } else {
            chunks.push(currentChunk.trim());
        }
    }
    return chunks;
}

// Apply timing to chunks and write SRT file
function writeChunksToSrt(chunks, totalDuration, outputPath) {
    if (!chunks || chunks.length === 0) return;

    function estimateSyllables(str) {
        return Math.max(1, Math.round(str.replace(/\s/g, '').length / 2.5));
    }

    const chunkSyllables = chunks.map(c => estimateSyllables(c));
    const totalSyllables = chunkSyllables.reduce((a, b) => a + b, 0);

    const gapPerChunk = chunks.length > 1 ? 0.08 : 0;
    const totalGaps = gapPerChunk * (chunks.length - 1);
    const speakTime = totalDuration - totalGaps;

    let srtContent = '';
    let cursor = 0;

    chunks.forEach((chunk, i) => {
        const syllRatio = chunkSyllables[i] / totalSyllables;
        const chunkDur = syllRatio * speakTime;
        const start = Math.max(0, cursor);
        const end = Math.min(totalDuration, cursor + chunkDur);
        srtContent += `${i + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${chunk}\n\n`;
        cursor = end + gapPerChunk;
    });

    fs.writeFileSync(outputPath, srtContent.trim());
    console.log(`SRT: ${chunks.length} chunks, ${totalSyllables} syllables, ${totalDuration.toFixed(1)}s`);
}

// Main fallback: AI chunking first, then mechanical
async function createSrtFile(text, totalDuration, outputPath, isFastPace = false, apiKey = null) {
    let textStr = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
    textStr = textStr.replace(/\s+/g, ' ').trim();

    let chunks = null;
    if (apiKey) {
        chunks = await aiChunkText(textStr, apiKey);
    }
    if (!chunks || chunks.length === 0) {
        console.log('Using mechanical word segmentation...');
        chunks = mechanicalChunk(textStr);
    }

    writeChunksToSrt(chunks, totalDuration, outputPath);
}

// Shift all SRT timestamps by a given offset (in seconds)
function shiftSrtTimestamps(srtText, offsetSeconds) {
    function parseTimeToSeconds(timeStr) {
        const match = timeStr.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
        if (!match) return 0;
        return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
    }

    function secondsToSrtTime(totalSec) {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        const ms = Math.floor((totalSec % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }

    const blocks = srtText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
    let result = '';
    let seq = 1;

    for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
        const timeIdx = lines.findIndex(l => l.includes('-->'));
        if (timeIdx === -1) continue;

        const timeParts = lines[timeIdx].split('-->');
        const startSec = parseTimeToSeconds(timeParts[0]) + offsetSeconds;
        const endSec = parseTimeToSeconds(timeParts[1]) + offsetSeconds;
        const text = lines.slice(timeIdx + 1).join('\n');

        result += `${seq}\n${secondsToSrtTime(startSec)} --> ${secondsToSrtTime(endSec)}\n${text}\n\n`;
        seq++;
    }

    return result.trim();
}

export async function POST(request) {
    try {
        const { projectId, audioFile, imageFiles, format, animation, subtitle, subtitleStyle, titleOverlay, scriptText, bgmFile, bgmVolume, ttsEmotion } = await request.json();

        if (!audioFile || !imageFiles || imageFiles.length === 0) {
            return NextResponse.json({ error: 'ต้องมีไฟล์เสียงและรูปภาพ' }, { status: 400 });
        }

        const videoId = uuidv4();
        const outputFileName = `${projectId || 'video'}_${videoId}.mp4`;
        const outputPath = path.join(VIDEOS_DIR, outputFileName);

        const audioPath = path.join(ROOT_DIR, 'data', audioFile.replace('/api/uploads/', '').replace('/uploads/', ''));

        let audioDuration;
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`
            );
            audioDuration = parseFloat(stdout.trim());
        } catch {
            audioDuration = 30;
        }

        const formatSettings = {
            youtube_shorts: { width: 1080, height: 1920 },
            youtube_doc: { width: 1920, height: 1080 },
            podcast: { width: 1920, height: 1080 },
            tiktok: { width: 1080, height: 1920 },
            reels: { width: 1080, height: 1920 },
            square: { width: 1080, height: 1080 }
        };

        const { width, height } = formatSettings[format] || formatSettings.youtube_shorts;
        const animationType = animation || 'random';
        const imageDuration = audioDuration / imageFiles.length;

        const imagePaths = imageFiles.map(img =>
            path.join(ROOT_DIR, 'data', img.replace('/api/uploads/', '').replace('/uploads/', ''))
        );

        let srtPath = null;
        let srtRelativePath = null;

        const fastPaceEmotions = ['documentary', 'drama', 'surprised', 'angry'];
        const isFastPace = fastPaceEmotions.includes(ttsEmotion);

        let activeTitleText = titleOverlay?.projectName || 'Untitled';

        if ((subtitle && scriptText) || (titleOverlay && titleOverlay.show)) {
            srtPath = path.join(VIDEOS_DIR, `subtitles_${videoId}.srt`);
            srtRelativePath = `data/videos/subtitles_${videoId}.srt`;

            let geminiSuccess = false;
            try {
                const apiKey = await getActiveKey();
                if (apiKey) {
                    const ai = new GoogleGenAI({ apiKey });

                    // 1. Title Analysis is no longer needed here as it's either pre-generated 
                    // or used directly in the cover generation prompt below.

                    // 1. Generate AI Cover Image if requested
                    if (titleOverlay && titleOverlay.show && titleOverlay.type === 'ai_cover') {
                        try {
                            if (titleOverlay.useExistingCover && titleOverlay.existingCoverPath) {
                                // Use the pre-generated cover
                                let fullPathToExisting = titleOverlay.existingCoverPath;
                                // Convert URL path to absolute local path if needed
                                if (fullPathToExisting.startsWith('/api/uploads/images/')) {
                                    const fileName = fullPathToExisting.replace('/api/uploads/images/', '');
                                    fullPathToExisting = path.join(IMAGES_DIR, fileName);
                                }

                                if (fs.existsSync(fullPathToExisting)) {
                                    imagePaths.unshift(fullPathToExisting);
                                    console.log('Using existing AI Cover image:', fullPathToExisting);
                                } else {
                                    throw new Error('Existing cover not found at: ' + fullPathToExisting);
                                }
                            } else {
                                // Generate NEW cover (rare case, fallback)
                                console.log('Generating AI Cover Image with text (fallback mode)...');
                                const activeTitleText = titleOverlay.activeTitleText || titleOverlay.projectName;
                                const coverPrompt = `A premium, cinematic social media cover image (no people or faces, focused on aesthetics).
The image MUST HAVE this exact THAI text title clearly and beautifully rendered in the center with modern typography: "${activeTitleText}".
Style: Cinematic, high contrast, vibrant colors, premium quality, clear text rendering.
Context: ${titleOverlay.projectName}.
Aspect Ratio: ${titleOverlay.aspectRatio || '9:16'}`;

                                const coverRes = await ai.models.generateContent({
                                    model: 'gemini-3.1-flash-image-preview',
                                    contents: coverPrompt,
                                    config: {
                                        responseModalities: ['image', 'text'],
                                        imageConfig: { aspectRatio: titleOverlay.aspectRatio || '9:16' }
                                    }
                                });

                                const parts = coverRes.candidates?.[0]?.content?.parts || [];
                                const imagePart = parts.find(p => p.inlineData);
                                if (imagePart) {
                                    const coverId = uuidv4();
                                    const fileName = `cover_${projectId || 'video'}_${coverId}.jpg`;
                                    const filePath = path.join(IMAGES_DIR, fileName);
                                    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
                                    fs.writeFileSync(filePath, imageBuffer);

                                    // Prepend to imagePaths
                                    imagePaths.unshift(filePath);
                                    console.log('AI Cover image generated (fallback):', fileName);
                                }
                            }
                        } catch (e) {
                            console.error('AI Cover generation/loading failed:', e);
                        }
                    }

                    // 2. Generate SRT using Gemini audio analysis
                    // Use gemini-2.5-flash for audio - it reliably supports multimodal audio input
                    if (subtitle && scriptText) {
                        console.log(`Attempting Gemini SRT generation (fastPace=${isFastPace})...`);
                        const audioBuffer = fs.readFileSync(audioPath);
                        const audioBase64 = audioBuffer.toString('base64');
                        const ext = path.extname(audioPath).toLowerCase();
                        let mimeType = 'audio/wav';
                        if (ext === '.mp3') mimeType = 'audio/mp3';
                        else if (ext === '.aac') mimeType = 'audio/aac';
                        else if (ext === '.m4a') mimeType = 'audio/m4a';

                        const prompt = `Listen to this Thai audio and create PERFECTLY SYNCHRONIZED .srt subtitles.

RULES:
1. Each subtitle MUST start at the EXACT moment the speaker begins that phrase.
2. Each subtitle MUST end when the speaker finishes that phrase.
3. Maximum 5 Thai words per subtitle line. NEVER cut a Thai word in half.
4. Script reference: "${scriptText.substring(0, 2500)}"
5. Return ONLY raw SRT. No markdown, no code blocks, no explanation.
6. Timestamps: HH:MM:SS,MMM (COMMA before ms).
7. The last subtitle should end near ${audioDuration.toFixed(1)} seconds.
${isFastPace ? '8. Fast speech - use shorter segments.' : ''}`;

                        const result = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: prompt },
                                        { inlineData: { data: audioBase64, mimeType } }
                                    ]
                                }
                            ]
                        });

                        let rawSrt = "";
                        try {
                            if (result && result.response && typeof result.response.text === 'function') {
                                rawSrt = result.response.text();
                            } else if (result && typeof result.text === 'string') {
                                rawSrt = result.text;
                            } else if (result && typeof result.text === 'function') {
                                rawSrt = result.text();
                            } else {
                                throw new Error('Cannot extract text from Gemini response');
                            }
                        } catch (e) {
                            console.error("Gemini response error:", e.message);
                            throw e;
                        }

                        if (rawSrt && rawSrt.includes('-->')) {
                            rawSrt = rawSrt.replace(/```(srt|txt)?/ig, '').replace(/```/g, '').trim();
                            rawSrt = rawSrt.replace(/\r\n/g, '\n');

                            function timeToSec(t) {
                                const match = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
                                if (!match) return 0;
                                return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
                            }

                            // Parse all valid blocks
                            const entries = [];
                            const blocks = rawSrt.split(/\n\s*\n/);
                            for (const block of blocks) {
                                if (!block.trim()) continue;
                                const lines = block.split('\n').map(l => l.trim()).filter(l => l);
                                const timeIdx = lines.findIndex(l => l.includes('-->'));
                                if (timeIdx === -1) continue;

                                const [rawStart, rawEnd] = lines[timeIdx].split('-->');
                                const startSec = timeToSec(rawStart);
                                const endSec = timeToSec(rawEnd);
                                const text = lines.slice(timeIdx + 1).join('\n').trim();

                                if (endSec > startSec && endSec > 0 && text) {
                                    entries.push({ startSec, endSec, text });
                                }
                            }

                            // Validate
                            const lastEnd = entries.length > 0 ? entries[entries.length - 1].endSec : 0;
                            const isOrdered = entries.every((e, i) => i === 0 || e.startSec >= entries[i - 1].startSec);

                            if (entries.length >= 3 && isOrdered && lastEnd > 3) {
                                // Drift correction: scale timestamps if they don't match audio duration
                                const scale = lastEnd > 0 ? audioDuration / lastEnd : 1;
                                const needsScale = Math.abs(lastEnd - audioDuration) > 1.5;

                                let finalSrt = '';
                                entries.forEach((e, i) => {
                                    const s = needsScale ? e.startSec * scale : e.startSec;
                                    const en = needsScale ? e.endSec * scale : e.endSec;
                                    finalSrt += `${i + 1}\n${formatTime(s)} --> ${formatTime(Math.min(en, audioDuration))}\n${e.text}\n\n`;
                                });

                                fs.writeFileSync(srtPath, finalSrt.trim());
                                geminiSuccess = true;
                                console.log(`✅ Gemini SRT: ${entries.length} blocks, last=${lastEnd.toFixed(1)}s, audio=${audioDuration.toFixed(1)}s${needsScale ? `, scaled x${scale.toFixed(2)}` : ''}`);
                            } else {
                                console.log(`❌ Gemini SRT rejected: ${entries.length} blocks, ordered=${isOrdered}, lastEnd=${lastEnd.toFixed(1)}s`);
                            }
                        } else {
                            console.log('❌ Gemini returned no SRT content');
                        }
                    }
                }
            } catch (geminiError) {
                console.error('Gemini SRT failed:', geminiError.message);
            }

            if (!geminiSuccess && subtitle && scriptText) {
                console.log('⚠️ Using fallback SRT algorithm...');
                const fallbackKey = await getActiveKey();
                await createSrtFile(scriptText, audioDuration, srtPath, isFastPace, fallbackKey);
            }
        }

        let subtitleFilter = '';
        if (srtPath) {
            const fontsDir = 'data/fonts';
            const isPortrait = height > width;

            // Font size: larger for impact, scaled for portrait
            let baseFontSize = (subtitleStyle && subtitleStyle.size) ? parseInt(subtitleStyle.size) || 58 : 58;
            // For portrait (1080x1920): scale to fit but keep it bold and readable
            const fontSize = isPortrait ? Math.round(baseFontSize * 0.75) : baseFontSize;

            let primaryColor = '&H00FFFFFF'; // White text
            let outlineColor = '&H00000000'; // Black outline
            let backColor = '&H80000000';    // Semi-transparent black shadow
            if (subtitleStyle && subtitleStyle.color === 'yellow_black') { primaryColor = '&H0000E6FF'; }
            else if (subtitleStyle && subtitleStyle.color === 'black_white') { primaryColor = '&H00000000'; outlineColor = '&H00FFFFFF'; backColor = '&H80FFFFFF'; }

            // Thick outline for readability (like the reference image)
            let outline = '4';
            if (subtitleStyle && subtitleStyle.bg === 'thin') outline = '2';
            else if (subtitleStyle && subtitleStyle.bg === 'thick') outline = '5';
            let shadow = '2'; // Drop shadow for depth

            const selectedFont = (subtitleStyle && subtitleStyle.font) ? subtitleStyle.font : 'Kanit';
            let alignment = '2'; // Bottom center
            let marginV = isPortrait ? 140 : 60;
            let marginLR = isPortrait ? 50 : 20;
            if (subtitleStyle && subtitleStyle.pos === 'top') { alignment = '8'; marginV = isPortrait ? 140 : 60; }
            else if (subtitleStyle && subtitleStyle.pos === 'center') { alignment = '5'; marginV = 0; }

            const assPath = srtPath.replace('.srt', '.ass');
            const assRelativePath = srtRelativePath.replace('.srt', '.ass');
            const assLines = [
                '[Script Info]',
                'ScriptType: v4.00+',
                `PlayResX: ${width}`,
                `PlayResY: ${height}`,
                'WrapStyle: 0',
                '',
                '[V4+ Styles]',
                'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
                `Style: Default,${selectedFont},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},-1,0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},${marginLR},${marginLR},${marginV},1`,
                '',
                '[Events]',
                'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            ];

            if (subtitle && scriptText && fs.existsSync(srtPath)) {
                const srtContent = fs.readFileSync(srtPath, 'utf8');
                const srtBlocks = srtContent.replace(/\r\n/g, '\n').split(/\n\s*\n/);
                for (const block of srtBlocks) {
                    if (!block.trim()) continue;
                    const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
                    const timeIdx = lines.findIndex(l => l.includes('-->'));
                    if (timeIdx === -1) continue;
                    const timeParts = lines[timeIdx].split('-->');
                    const toAss = (t) => {
                        const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
                        if (!m) return '0:00:00.00';
                        const cs = Math.round(parseInt(m[4]) / 10);
                        return `${parseInt(m[1])}:${m[2]}:${m[3]}.${Math.min(cs, 99).toString().padStart(2, '0')}`;
                    };
                    const start = toAss(timeParts[0]);
                    const end = toAss(timeParts[1]);
                    const text = lines.slice(timeIdx + 1).join('\\N');
                    assLines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
                }
            }
            fs.writeFileSync(assPath, assLines.join('\n') + '\n');
            subtitleFilter = `,ass='${assRelativePath}':fontsdir='${fontsDir}'`;
        }

        let ffmpegCmd;
        let coverDuration = 0;
        let otherImageDuration = 0;
        const hasCover = titleOverlay && titleOverlay.show && titleOverlay.type === 'ai_cover';

        if (hasCover && imagePaths.length > 1) {
            coverDuration = parseFloat(titleOverlay.duration || 5);
            // Safety: Don't let cover take more than 50% of audio
            if (coverDuration > audioDuration * 0.5) coverDuration = audioDuration * 0.2;
            otherImageDuration = (audioDuration - coverDuration) / (imagePaths.length - 1);
        } else {
            otherImageDuration = audioDuration / imagePaths.length;
            coverDuration = otherImageDuration;
        }

        if (animationType === 'none') {
            const concatFile = path.join(VIDEOS_DIR, `concat_${videoId}.txt`);
            let concatContent = '';
            imagePaths.forEach((imgPath, idx) => {
                const duration = (idx === 0 && hasCover) ? coverDuration : otherImageDuration;
                concatContent += `file '${imgPath}'\nduration ${duration}\n`;
            });
            // Repeat last image for stability
            concatContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
            fs.writeFileSync(concatFile, concatContent);

            ffmpegCmd = [
                'ffmpeg -y',
                `-f concat -safe 0 -i "${concatFile}"`,
                `-i "${audioPath}"`,
                `-vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p${subtitleFilter}"`,
                `-c:v libx264 -preset medium -crf 23`,
                `-c:a aac -b:a 192k`,
                `-shortest`,
                `-movflags +faststart`,
                `"${outputPath}"`
            ].join(' ');

            await execAsync(ffmpegCmd, { timeout: 300000 });
            if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
        } else {
            // --- Version with Transitions (Cross-dissolve) ---
            const segmentFiles = [];
            const scaleW = width * 3;
            const scaleH = height * 3;
            const transDur = 0.5; // 0.5 sec transition

            // 1. Generate individual MP4 segments for each image
            console.log('Generating segments for transitions...');
            for (let i = 0; i < imagePaths.length; i++) {
                const baseDuration = (i === 0 && hasCover) ? coverDuration : otherImageDuration;
                // Add padding for transition (except last image)
                const isLast = i === imagePaths.length - 1;
                const segDuration = isLast ? baseDuration : baseDuration + transDur;
                const currentAnimType = (i === 0 && hasCover) ? 'none' : animationType;

                const segPath = path.join(VIDEOS_DIR, `seg_${videoId}_${i}.mp4`);
                segmentFiles.push(segPath);

                const filter = getAnimationFilter(currentAnimType, i, segDuration, width, height);
                const segCmd = [
                    'ffmpeg -y',
                    `-loop 1 -r 30 -i "${imagePaths[i]}"`,
                    `-vf "scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2:black,${filter},format=yuv420p"`,
                    `-r 30 -t ${segDuration}`,
                    `-c:v libx264 -preset ultrafast -crf 23 -an`,
                    `"${segPath}"`
                ].join(' ');
                await execAsync(segCmd);
            }

            // 2. Build Complex Filter for XFADE
            console.log('Building xfade filter graph...');
            let filterComplex = "";
            let currentOffset = 0;

            // Basic inputs: [0:v][1:v]...[N:v]
            for (let i = 0; i < imagePaths.length; i++) {
                const baseDuration = (i === 0 && hasCover) ? coverDuration : otherImageDuration;

                if (i === 0) {
                    // First segment, no xfade yet, just pass it through
                    filterComplex += `[${i}:v]setpts=PTS-STARTPTS[v${i}];`;
                    currentOffset += baseDuration;
                } else {
                    const prevLabel = `v${i - 1}`;
                    const currentLabel = `${i}:v`;
                    const outLabel = `v${i}`;

                    // The offset for xfade is the point in the output stream where the second input starts.
                    // This is the cumulative duration of previous segments minus the transition duration.
                    const xfadeOffset = currentOffset - transDur;

                    filterComplex += `[${prevLabel}][${currentLabel}]xfade=transition=fade:duration=${transDur}:offset=${xfadeOffset}[${outLabel}];`;
                    currentOffset += baseDuration;
                }
            }

            // Apply subtitle filter to the final video stream
            filterComplex += `[v${imagePaths.length - 1}]format=yuv420p${subtitleFilter}[vfinal]`;


            let ffmpegArgs = [
                'ffmpeg -y',
                ...segmentFiles.map(f => `-i "${f}"`),
                `-i "${audioPath}"`
            ];

            let audioMapping = `-c:a aac -b:a 192k`;
            if (bgmFile) {
                const bgmPath = path.join(ROOT_DIR, 'data', 'bgm', bgmFile);
                if (fs.existsSync(bgmPath)) {
                    ffmpegArgs.push(`-stream_loop -1 -i "${bgmPath}"`);
                    const vol = bgmVolume !== undefined ? bgmVolume : 0.2;
                    // Audio inputs: [imagePaths.length] is main audio, [imagePaths.length + 1] is BGM
                    audioMapping = `-filter_complex "[${imagePaths.length + 1}:a]volume=${vol}[bgm];[${imagePaths.length}:a][bgm]amix=inputs=2:duration=first[aout]" -map "[vfinal]" -map "[aout]"`;
                } else {
                    // BGM file not found, just map main audio
                    audioMapping = `-map "[vfinal]" -map ${imagePaths.length}:a`;
                }
            } else {
                // No BGM, just map main audio
                audioMapping = `-map "[vfinal]" -map ${imagePaths.length}:a`;
            }

            ffmpegCmd = [
                ...ffmpegArgs,
                `-filter_complex "${filterComplex}"`,
                `-c:v libx264 -preset medium -crf 23`,
                audioMapping,
                `-shortest -movflags +faststart`,
                `"${outputPath}"`
            ].join(' ');

            await execAsync(ffmpegCmd, { timeout: 0, maxBuffer: 1024 * 1024 * 500 });

            // Cleanup
            segmentFiles.forEach(f => { try { fs.unlinkSync(f); } catch { } });
        }

        if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);

        // Extract first frame as thumbnail
        let thumbnailPath = null;
        try {
            const thumbFileName = `thumb_${projectId || 'video'}_${videoId}.jpg`;
            const thumbAbsPath = path.join(IMAGES_DIR, thumbFileName);
            await execAsync(`ffmpeg -y -i "${outputPath}" -ss 0.1 -vframes 1 -q:v 2 "${thumbAbsPath}"`);
            if (fs.existsSync(thumbAbsPath)) {
                thumbnailPath = `/api/uploads/images/${thumbFileName}`;
                console.log('📸 Thumbnail extracted:', thumbFileName);
            }
        } catch (thumbErr) {
            console.error('Thumbnail extraction failed:', thumbErr.message);
        }

        const stats = fs.statSync(outputPath);
        return NextResponse.json({
            success: true,
            videoId,
            fileName: outputFileName,
            filePath: `/api/uploads/videos/${outputFileName}`,
            thumbnailPath,
            size: stats.size,
            duration: audioDuration,
            resolution: `${width}x${height}`,
            animation: animationType
        });
    } catch (err) {
        console.error('Video Creation Error:', err);
        return NextResponse.json({ error: `Video Error: ${err.message}` }, { status: 500 });
    }
}
