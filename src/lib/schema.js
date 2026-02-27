import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').default(''),
    platform: text('platform').default('youtube_shorts'),
    language: text('language').default('th'),
    status: text('status').default('draft'),
    steps: text('steps').notNull(), // Stored as JSON string
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
});

export const settings = sqliteTable('settings', {
    id: text('id').primaryKey(),
    value: text('value').notNull() // Stored as JSON string
});
