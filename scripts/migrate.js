import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

async function migrate() {
    console.log("Creating projects table...");
    await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      platform TEXT DEFAULT 'youtube_shorts',
      language TEXT DEFAULT 'th',
      status TEXT DEFAULT 'draft',
      steps TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

    console.log("Creating settings table...");
    await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

    console.log("Migration successful!");
}

migrate().catch(console.error);
