import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { projects } from '@/lib/schema';
import { desc } from 'drizzle-orm';

// GET /api/projects - Get all projects
export async function GET() {
    try {
        const result = await db.select().from(projects).orderBy(desc(projects.updatedAt));
        const formattedProjects = result.map(row => ({
            ...row,
            steps: JSON.parse(row.steps)
        }));
        return NextResponse.json(formattedProjects);
    } catch (err) {
        console.error('Failed to get projects from DB:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/projects - Create project  
export async function POST(request) {
    try {
        const { name, description, platform, language } = await request.json();
        const id = uuidv4();

        const steps = {
            script: { status: 'pending', content: '', generatedAt: null },
            audio: { status: 'pending', filePath: '', duration: 0, generatedAt: null },
            images: { status: 'pending', files: [], generatedAt: null },
            video: { status: 'pending', filePath: '', generatedAt: null }
        };

        const project = {
            id,
            name: name || 'Untitled Project',
            description: description || '',
            platform: platform || 'youtube_shorts',
            language: language || 'th',
            status: 'draft',
            steps,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const dbProject = { ...project, steps: JSON.stringify(project.steps) };
        await db.insert(projects).values(dbProject);

        return NextResponse.json(project, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
