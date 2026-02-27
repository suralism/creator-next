import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/projects/[id]
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const result = await db.select().from(projects).where(eq(projects.id, id));

        if (result.length === 0) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const row = result[0];
        const project = { ...row, steps: JSON.parse(row.steps) };
        return NextResponse.json(project);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PUT /api/projects/[id]
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const result = await db.select().from(projects).where(eq(projects.id, id));

        if (result.length === 0) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const row = result[0];
        const existingProject = { ...row, steps: JSON.parse(row.steps) };
        const body = await request.json();

        const updated = { ...existingProject, ...body, updatedAt: new Date().toISOString() };
        const dbProject = { ...updated, steps: JSON.stringify(updated.steps) };

        await db.update(projects).set(dbProject).where(eq(projects.id, id));
        return NextResponse.json(updated);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/projects/[id]
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        await db.delete(projects).where(eq(projects.id, id));
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
