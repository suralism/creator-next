import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

// GET /api/settings
export async function GET() {
    const settings = await getSettings();
    const masked = {
        ...settings,
        apiKeys: settings.apiKeys.map(k => ({
            ...k,
            key: k.key ? '•'.repeat(Math.max(0, k.key.length - 8)) + k.key.slice(-8) : '',
            fullKey: undefined
        }))
    };
    return NextResponse.json(masked);
}
