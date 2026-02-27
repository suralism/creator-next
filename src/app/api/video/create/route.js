import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
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

export async function POST(request) {
    try {
        const { projectId, audioFile, imageFiles, format, animation } = await request.json();

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

        let ffmpegCmd;

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
                `-vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p"`,
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
