import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/categories - List all categories
export async function GET() {
    try {
        const result = await db.select().from(categories);
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/categories - Create a category
export async function POST(request) {
    try {
        const { name, icon, color } = await request.json();
        if (!name) {
            return NextResponse.json({ error: 'กรุณาใส่ชื่อหมวดหมู่' }, { status: 400 });
        }

        const cat = {
            id: uuidv4(),
            name,
            icon: icon || '📁',
            color: color || '#6366f1',
            createdAt: new Date().toISOString(),
        };

        await db.insert(categories).values(cat);
        return NextResponse.json(cat, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
