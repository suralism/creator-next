import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// PUT /api/categories/[id] - Update a category
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const { name, icon, color } = await request.json();

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (icon !== undefined) updates.icon = icon;
        if (color !== undefined) updates.color = color;

        await db.update(categories).set(updates).where(eq(categories.id, id));
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/categories/[id] - Delete a category
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        await db.delete(categories).where(eq(categories.id, id));
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
