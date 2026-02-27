import { db } from './db.js';
import { settings as settingsTable } from './schema.js';
import { eq } from 'drizzle-orm';

const SETTINGS_ID = 'singleton-settings';

export async function getSettings() {
    try {
        const result = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ID));
        if (result.length > 0) {
            return JSON.parse(result[0].value);
        }
    } catch (err) {
        console.error('Error fetching settings from db:', err);
    }
    return {
        apiKeys: [],
        activeKeyId: null,
    };
}

export async function saveSettings(settings) {
    const value = JSON.stringify(settings, null, 2);
    try {
        const existing = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ID));
        if (existing.length > 0) {
            await db.update(settingsTable).set({ value }).where(eq(settingsTable.id, SETTINGS_ID));
        } else {
            await db.insert(settingsTable).values({ id: SETTINGS_ID, value });
        }
    } catch (err) {
        console.error('Error saving settings to db:', err);
    }
}

export async function getActiveKey() {
    const settings = await getSettings();
    if (!settings.apiKeys || settings.apiKeys.length === 0) return null;

    if (settings.activeKeyId) {
        const active = settings.apiKeys.find(k => k.id === settings.activeKeyId);
        if (active) return active.key;
    }

    // Fallback to first key
    return settings.apiKeys[0]?.key || null;
}

export async function getPageToken(pageId) {
    const settings = await getSettings();

    // Migrate old format
    if (settings.facebookPageToken && !settings.facebookPages) {
        if (settings.facebookPageId === pageId) return settings.facebookPageToken;
        return settings.facebookPageToken; // fallback
    }

    const pages = settings.facebookPages || [];
    const page = pages.find(p => p.pageId === pageId);
    if (page) return page.token;

    // Return first page token as fallback
    return pages[0]?.token || null;
}
