import { createClient } from "@libsql/client";
import "dotenv/config";
import * as fs from "fs";

const url = formUrl();

function formUrl() {
    return process.env.TURSO_DB_URL;
}

const client = createClient({
    url: url,
    authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

async function run() {
    try {
        console.log("Connecting to DB:", url);

        // Execute table creations
        await client.execute(`CREATE TABLE IF NOT EXISTS \`projects\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`name\` text NOT NULL,
            \`description\` text DEFAULT '',
            \`platform\` text DEFAULT 'youtube_shorts',
            \`language\` text DEFAULT 'th',
            \`status\` text DEFAULT 'draft',
            \`steps\` text NOT NULL,
            \`createdAt\` text NOT NULL,
            \`updatedAt\` text NOT NULL
        );`);
        console.log("Created table: projects");

        await client.execute(`CREATE TABLE IF NOT EXISTS \`settings\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`value\` text NOT NULL
        );`);
        console.log("Created table: settings");

        // Categories table
        await client.execute(`CREATE TABLE IF NOT EXISTS \`categories\` (
            \`id\` text PRIMARY KEY NOT NULL,
            \`name\` text NOT NULL,
            \`icon\` text DEFAULT '📁',
            \`color\` text DEFAULT '#6366f1',
            \`createdAt\` text NOT NULL
        );`);
        console.log("Created table: categories");

        // Add category column to projects if not exists
        try {
            await client.execute(`ALTER TABLE \`projects\` ADD COLUMN \`category\` text DEFAULT '';`);
            console.log("Added column: projects.category");
        } catch (e) {
            console.log("Column projects.category already exists");
        }

        let schema = await client.execute(`SELECT name FROM sqlite_master WHERE type='table';`);
        console.log("Tables in DB:", schema.rows);
    } catch (err) {
        console.error("Migration error:", err);
    }
}

run();
