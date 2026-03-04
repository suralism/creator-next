import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/schema';
import fs from 'fs';
import path from 'path';

// GET /api/storage — Get storage usage info
export async function GET() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const allProjects = await db.select().from(projects);
        const activeProjectIds = new Set(allProjects.map(p => p.id));

        const folders = ['images', 'audio', 'videos', 'exports'];
        const storageInfo = { totalSize: 0, folders: {}, orphanedFiles: [], orphanedSize: 0, projectSizes: {} };

        for (const folder of folders) {
            const folderPath = path.join(dataDir, folder);
            if (!fs.existsSync(folderPath)) continue;

            let folderSize = 0;
            let fileCount = 0;
            const entries = fs.readdirSync(folderPath);

            for (const entry of entries) {
                const entryPath = path.join(folderPath, entry);
                let entrySize = 0;

                try {
                    const stat = fs.statSync(entryPath);
                    if (stat.isDirectory()) {
                        // Recursively calculate directory size
                        const subFiles = fs.readdirSync(entryPath);
                        for (const sf of subFiles) {
                            try {
                                const sfStat = fs.statSync(path.join(entryPath, sf));
                                entrySize += sfStat.size;
                            } catch { }
                        }
                    } else {
                        entrySize = stat.size;
                    }
                } catch { continue; }

                folderSize += entrySize;
                fileCount++;

                // Extract project ID from filename (format: projectId_fileId.ext)
                const projectId = entry.split('_')[0];
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

                if (isUUID) {
                    // Track per-project size
                    if (!storageInfo.projectSizes[projectId]) {
                        storageInfo.projectSizes[projectId] = { size: 0, files: 0, isOrphaned: !activeProjectIds.has(projectId) };
                    }
                    storageInfo.projectSizes[projectId].size += entrySize;
                    storageInfo.projectSizes[projectId].files++;

                    // Check if orphaned  
                    if (!activeProjectIds.has(projectId)) {
                        storageInfo.orphanedFiles.push({ folder, file: entry, size: entrySize });
                        storageInfo.orphanedSize += entrySize;
                    }
                }
            }

            storageInfo.folders[folder] = { size: folderSize, files: fileCount };
            storageInfo.totalSize += folderSize;
        }

        // Format sizes
        const formatSize = (bytes) => {
            if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
            if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
            if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${bytes} B`;
        };

        // Build summary with project names
        const projectList = [];
        for (const [projectId, info] of Object.entries(storageInfo.projectSizes)) {
            const project = allProjects.find(p => p.id === projectId);
            projectList.push({
                id: projectId,
                name: project?.title || '(ลบแล้ว)',
                size: info.size,
                sizeFormatted: formatSize(info.size),
                files: info.files,
                isOrphaned: info.isOrphaned
            });
        }

        // Sort by size descending
        projectList.sort((a, b) => b.size - a.size);

        // Count temp files size
        let tempFilesSize = 0;
        let tempFilesCount = 0;
        const videosDir = path.join(dataDir, 'videos');
        if (fs.existsSync(videosDir)) {
            const entries = fs.readdirSync(videosDir);
            for (const entry of entries) {
                const isTempFile = entry.startsWith('seg_') ||
                    entry.startsWith('concat_') ||
                    entry.startsWith('sub_test') ||
                    entry.startsWith('subtitles_') ||
                    entry.startsWith('replaced_') ||
                    entry === 'subtitles_fixed.srt';
                if (isTempFile) {
                    try {
                        tempFilesSize += fs.statSync(path.join(videosDir, entry)).size;
                        tempFilesCount++;
                    } catch { }
                }
            }
        }

        return NextResponse.json({
            totalSize: storageInfo.totalSize,
            totalSizeFormatted: formatSize(storageInfo.totalSize),
            orphanedSize: storageInfo.orphanedSize,
            orphanedSizeFormatted: formatSize(storageInfo.orphanedSize),
            orphanedFileCount: storageInfo.orphanedFiles.length,
            tempFilesSize,
            tempFilesSizeFormatted: formatSize(tempFilesSize),
            tempFilesCount,
            folders: Object.fromEntries(
                Object.entries(storageInfo.folders).map(([k, v]) => [k, { ...v, sizeFormatted: formatSize(v.size) }])
            ),
            projects: projectList,
            activeProjectCount: activeProjectIds.size,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/storage — Clean up orphaned files or specific project files
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { action, projectId } = body;
        // action: 'orphaned' | 'project' | 'temp'

        const dataDir = path.join(process.cwd(), 'data');
        const folders = ['images', 'audio', 'videos', 'exports'];
        let deletedCount = 0;
        let freedSpace = 0;

        if (action === 'orphaned') {
            // Delete all orphaned files (files for deleted projects)
            const allProjects = await db.select().from(projects);
            const activeIds = new Set(allProjects.map(p => p.id));

            for (const folder of folders) {
                const folderPath = path.join(dataDir, folder);
                if (!fs.existsSync(folderPath)) continue;

                const entries = fs.readdirSync(folderPath);
                for (const entry of entries) {
                    const pid = entry.split('_')[0];
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);

                    if (isUUID && !activeIds.has(pid)) {
                        try {
                            const filePath = path.join(folderPath, entry);
                            const stat = fs.statSync(filePath);
                            if (stat.isDirectory()) {
                                const subFiles = fs.readdirSync(filePath);
                                for (const sf of subFiles) {
                                    try { freedSpace += fs.statSync(path.join(filePath, sf)).size; } catch { }
                                }
                                fs.rmSync(filePath, { recursive: true, force: true });
                            } else {
                                freedSpace += stat.size;
                                fs.unlinkSync(filePath);
                            }
                            deletedCount++;
                        } catch (e) {
                            console.error(`Failed to delete ${entry}:`, e.message);
                        }
                    }
                }
            }
        } else if (action === 'project' && projectId) {
            // Delete all files for a specific project
            for (const folder of folders) {
                const folderPath = path.join(dataDir, folder);
                if (!fs.existsSync(folderPath)) continue;

                const entries = fs.readdirSync(folderPath);
                for (const entry of entries) {
                    if (entry.startsWith(projectId)) {
                        try {
                            const filePath = path.join(folderPath, entry);
                            const stat = fs.statSync(filePath);
                            if (stat.isDirectory()) {
                                const subFiles = fs.readdirSync(filePath);
                                for (const sf of subFiles) {
                                    try { freedSpace += fs.statSync(path.join(filePath, sf)).size; } catch { }
                                }
                                fs.rmSync(filePath, { recursive: true, force: true });
                            } else {
                                freedSpace += stat.size;
                                fs.unlinkSync(filePath);
                            }
                            deletedCount++;
                        } catch (e) {
                            console.error(`Failed to delete ${entry}:`, e.message);
                        }
                    }
                }
            }
        } else if (action === 'temp') {
            // Delete temp files (segments, concat files, subtitles, replaced videos)
            const videosDir = path.join(dataDir, 'videos');
            if (fs.existsSync(videosDir)) {
                const entries = fs.readdirSync(videosDir);
                for (const entry of entries) {
                    const isTempFile = entry.startsWith('seg_') ||
                        entry.startsWith('concat_') ||
                        entry.startsWith('sub_test') ||
                        entry.startsWith('subtitles_') ||
                        entry.startsWith('replaced_') ||
                        entry === 'subtitles_fixed.srt';

                    if (isTempFile) {
                        try {
                            const filePath = path.join(videosDir, entry);
                            freedSpace += fs.statSync(filePath).size;
                            fs.unlinkSync(filePath);
                            deletedCount++;
                        } catch (e) {
                            console.error(`Failed to delete ${entry}:`, e.message);
                        }
                    }
                }
            }
        }

        const formatSize = (bytes) => {
            if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
            if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
            return `${(bytes / 1024).toFixed(1)} KB`;
        };

        return NextResponse.json({
            success: true,
            deletedCount,
            freedSpace,
            freedSpaceFormatted: formatSize(freedSpace)
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
