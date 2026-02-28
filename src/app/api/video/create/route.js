import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getActiveKey } from '@/lib/settings';
import { ROOT_DIR, VIDEOS_DIR } from '@/lib/paths';

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

function createSrtFile(text, totalDuration, outputPath) {
    // 1. Remove non-spoken stage directions/emotions same as we did for TTS
    let textStr = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');
    // 2. Normalize whitespace
    textStr = textStr.replace(/\s+/g, ' ').trim();
    const chunks = [];
    let currentChunk = '';

    // Split Thai script properly using Intl.Segmenter
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const segments = segmenter.segment(textStr);

    for (const { segment } of segments) {
        if (currentChunk.length + segment.length > 20) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += segment;
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    const totalChars = chunks.reduce((acc, c) => acc + c.replace(/\s/g, '').length, 0);
    let srtContent = '';
    let currentTime = 0;

    chunks.forEach((chunk, index) => {
        const chunkChars = chunk.replace(/\s/g, '').length;
        const duration = (chunkChars / totalChars) * totalDuration;
        const startTime = formatTime(currentTime);
        const endTime = formatTime(currentTime + duration);
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${chunk}\n\n`;
        currentTime += duration;
    });
    fs.writeFileSync(outputPath, srtContent);
}

export async function POST(request) {
    try {
        const { projectId, audioFile, imageFiles, format, animation, subtitle, subtitleStyle, scriptText } = await request.json();

        if (!audioFile || !imageFiles || imageFiles.length === 0) {
            return NextResponse.json({ error: 'ต้องมีไฟล์เสียงและรูปภาพ' }, { status: 400 });
        }

        const videoId = uuidv4();
        const outputFileName = `${projectId || 'video'}_${videoId}.mp4`;
        const outputPath = path.join(VIDEOS_DIR, outputFileName);

        // Resolve file paths - handle both /uploads/ and /api/uploads/ prefixes
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

        if (subtitle && scriptText) {
            srtPath = path.join(VIDEOS_DIR, `subtitles_${videoId}.srt`);
            srtRelativePath = `data/videos/subtitles_${videoId}.srt`;

            let geminiSuccess = false;
            try {
                const apiKey = await getActiveKey();
                if (apiKey) {
                    console.log('Attempting to use Gemini Flash for highly accurate SRT generation...');
                    const ai = new GoogleGenAI({ apiKey });
                    const audioBuffer = fs.readFileSync(audioPath);
                    const audioBase64 = audioBuffer.toString('base64');
                    // Get mime type based on extension
                    const ext = path.extname(audioPath).toLowerCase();
                    let mimeType = 'audio/wav';
                    if (ext === '.mp3') mimeType = 'audio/mp3';
                    else if (ext === '.aac') mimeType = 'audio/aac';
                    else if (ext === '.m4a') mimeType = 'audio/m4a';

                    // Prompt to extract an accurate SRT
                    const prompt = `You are a professional subtitler for shorts and reels videos.
Please listen to the attached audio file in Thai language, and generate highly accurate sync-timed subtitles in SubRip (.srt) format.
The spoken script text inside the audio should be exactly this:
"${scriptText}"

Rules:
1. Wrap the text nicely. Limit each subtitle line to a maximum of 20 characters, split into nice logical chunks (short fragments) perfect for fast vertical videos.
2. Provide ONLY the raw SRT format. Do not use markdown blocks like \`\`\`srt. Just output the text.
3. Timestamps MUST strictly follow the standard SRT format exactly: HH:MM:SS,MMM --> HH:MM:SS,MMM (e.g., 00:00:01,250 --> 00:00:03,450). Notice the COMMA before the 3-digit milliseconds!

Your SRT Output:`;

                    const response = await ai.models.generateContent({
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

                    let rawSrt = response.text || '';
                    rawSrt = rawSrt.replace(/```(srt|txt)?/ig, '').replace(/```/g, '').trim();
                    rawSrt = rawSrt.replace(/\r\n/g, '\n');

                    // Bulletproof SRT Formatting Algorithm to force perfect FFmpeg parsing
                    function extractTime(timeStr) {
                        if (!timeStr) return '00:00:00,000';
                        const parts = timeStr.trim().split(/[^0-9]+/);
                        const nums = parts.filter(p => p !== '');
                        if (nums.length === 0) return '00:00:00,000';
                        if (nums.length === 1) return '00:00:00,' + nums[0].padStart(3, '0').substring(0, 3);

                        let ms = nums[nums.length - 1].padEnd(3, '0').substring(0, 3);
                        let s = nums.length >= 2 ? nums[nums.length - 2].padStart(2, '0').substring(0, 2) : '00';
                        let m = nums.length >= 3 ? nums[nums.length - 3].padStart(2, '0').substring(0, 2) : '00';
                        let h = nums.length >= 4 ? nums[nums.length - 4].padStart(2, '0').substring(0, 2) : '00';

                        return `${h}:${m}:${s},${ms}`;
                    }

                    const blocks = rawSrt.split(/\n\s*\n/);
                    let finalSrt = '';
                    let seq = 1;

                    for (let block of blocks) {
                        if (!block.trim()) continue;
                        let lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
                        let timeIdx = lines.findIndex(l => l.includes('-->'));

                        if (timeIdx !== -1) {
                            let timeParts = lines[timeIdx].split('-->');
                            let start = extractTime(timeParts[0]);
                            let end = extractTime(timeParts[1]);

                            let textLines = lines.slice(timeIdx + 1).join('\n');
                            finalSrt += seq + '\n' + start + ' --> ' + end + '\n' + textLines + '\n\n';
                            seq++;
                        }
                    }

                    fs.writeFileSync(srtPath, finalSrt.trim());
                    geminiSuccess = true;
                    console.log('Gemini generated SRT successfully!');
                }
            } catch (geminiError) {
                console.error('Gemini SRT generation failed, falling back to algorithmic sync:', geminiError.message);
            }

            // Fallback algorithm if Gemini failed or no API key
            if (!geminiSuccess) {
                createSrtFile(scriptText, audioDuration, srtPath);
            }
        }

        let ffmpegCmd;

        // Ensure subtitle string works in FFmpeg filter without drive letter colon escaping issues
        let subtitleFilter = '';
        if (srtRelativePath) {
            const fontsDir = 'data/fonts';
            const srtFile = srtRelativePath;
            const isPortrait = height > width;

            // 1. Process Font Size (portrait base=1080w, landscape base=1080h)
            const sizeMap = {
                small: isPortrait ? 0.013 : 0.018,
                medium: isPortrait ? 0.018 : 0.025,
                large: isPortrait ? 0.025 : 0.035
            };
            const sizeMult = (subtitleStyle && subtitleStyle.size) ? sizeMap[subtitleStyle.size] : sizeMap.medium;
            const fontSize = Math.floor((isPortrait ? width : height) * sizeMult);

            // 2. Process Colors
            let primaryColor = '&H00FFFFFF'; // White
            let outlineColor = '&H00000000'; // Black

            if (subtitleStyle && subtitleStyle.color === 'yellow_black') {
                primaryColor = '&H0000E6FF'; // ASS colors are BGR: FF E6 00 -> 00 E6 FF
            } else if (subtitleStyle && subtitleStyle.color === 'black_white') {
                primaryColor = '&H00000000'; // Black
                outlineColor = '&H00FFFFFF'; // White
            }

            // 3. Process Outline Thickness (clean outline, no background box)
            let outline = '2';
            if (subtitleStyle && subtitleStyle.bg === 'thin') {
                outline = '1';
            } else if (subtitleStyle && subtitleStyle.bg === 'thick') {
                outline = '3';
            }

            // 4. Process Font Family — use Bold variant font files directly
            //    (Synthetic Bold=1 in ASS causes Thai vowel/tonemark overlap)
            const fontMap = {
                'Kanit': 'Kanit Bold',
                'Prompt': 'Prompt Bold',
                'Sarabun': 'Sarabun Bold'
            };
            const selectedFont = (subtitleStyle && subtitleStyle.font) ? subtitleStyle.font : 'Kanit';
            const fontFamily = fontMap[selectedFont] || 'Kanit Bold';

            // 5. Process Position (ASS Alignment: 2=bottom-center, 5=mid-center, 8=top-center)
            let alignment = '2'; // bottom center (default)
            let marginV = isPortrait ? 100 : 50;

            if (subtitleStyle && subtitleStyle.pos === 'top') {
                alignment = '8';
                marginV = isPortrait ? 100 : 50;
            } else if (subtitleStyle && subtitleStyle.pos === 'center') {
                alignment = '5';
                marginV = 0;
            }

            subtitleFilter = `,subtitles='${srtFile}':fontsdir='${fontsDir}':force_style='Fontname=${fontFamily},FontSize=${fontSize},Alignment=${alignment},PrimaryColour=${primaryColor},OutlineColour=${outlineColor},BackColour=&H00000000,BorderStyle=1,Outline=${outline},Shadow=0,MarginV=${marginV},WrapStyle=1'`;
        }

        if (animationType === 'none') {
            const concatFile = path.join(VIDEOS_DIR, `concat_${videoId}.txt`);
            let concatContent = '';
            imagePaths.forEach(imgPath => {
                concatContent += `file '${imgPath}'\nduration ${imageDuration}\n`;
            });
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

            console.log('Running FFmpeg (no animation):', ffmpegCmd.substring(0, 120), '...');
            await execAsync(ffmpegCmd, { timeout: 300000 });

            if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
        } else {
            const segmentFiles = [];
            const scaleW = width * 3;
            const scaleH = height * 3;

            for (let i = 0; i < imagePaths.length; i++) {
                const segPath = path.join(VIDEOS_DIR, `seg_${videoId}_${i}.mp4`);
                segmentFiles.push(segPath);

                const filter = getAnimationFilter(animationType, i, imageDuration, width, height);

                const segCmd = [
                    'ffmpeg -y',
                    `-loop 1 -i "${imagePaths[i]}"`,
                    `-vf "scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2:black,${filter},format=yuv420p"`,
                    `-t ${imageDuration}`,
                    `-c:v libx264 -preset medium -crf 23`,
                    `-an`,
                    `"${segPath}"`
                ].join(' ');

                console.log(`Segment ${i + 1}/${imagePaths.length}: ${animationType}`);
                await execAsync(segCmd, { timeout: 0, maxBuffer: 1024 * 1024 * 100 });
            }

            const concatFile = path.join(VIDEOS_DIR, `concat_${videoId}.txt`);
            const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n');
            fs.writeFileSync(concatFile, concatContent);

            ffmpegCmd = [
                'ffmpeg -y',
                `-f concat -safe 0 -i "${concatFile}"`,
                `-i "${audioPath}"`,
                `-vf "format=yuv420p${subtitleFilter}"`,
                `-c:v libx264 -preset medium -crf 23`,
                `-c:a aac -b:a 192k`,
                `-shortest`,
                `-movflags +faststart`,
                `"${outputPath}"`
            ].join(' ');

            console.log('Concatenating segments...');
            await execAsync(ffmpegCmd, { timeout: 0, maxBuffer: 1024 * 1024 * 100 });

            segmentFiles.forEach(f => { try { fs.unlinkSync(f); } catch { } });
            if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
        }

        if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);

        const stats = fs.statSync(outputPath);

        return NextResponse.json({
            success: true,
            videoId,
            fileName: outputFileName,
            filePath: `/api/uploads/videos/${outputFileName}`,
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
