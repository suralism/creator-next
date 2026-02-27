import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settings';

// POST /api/settings/api-keys - Add new key
export async function POST(request) {
    const { label, key } = await request.json();

    if (!key || key.trim().length === 0) {
        return NextResponse.json({ error: 'กรุณาใส่ API Key' }, { status: 400 });
    }

    const settings = await getSettings();
    const id = `key_${Date.now()}`;
    const newKey = {
        id,
        label: label || `Key ${settings.apiKeys.length + 1}`,
        key: key.trim(),
        createdAt: new Date().toISOString()
    };

    settings.apiKeys.push(newKey);

    if (settings.apiKeys.length === 1) {
        settings.activeKeyId = id;
    }

    await saveSettings(settings);
    return NextResponse.json({
        id: newKey.id,
        label: newKey.label,
        key: '•'.repeat(Math.max(0, key.length - 8)) + key.slice(-8),
        createdAt: newKey.createdAt
    }, { status: 201 });
}
