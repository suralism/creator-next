import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_DB_AUTH_TOKEN;

if (!url || !authToken) {
    console.warn("⚠️ TURSO_DB_URL or TURSO_DB_AUTH_TOKEN is missing in .env");
}

const client = createClient({
    url: url,
    authToken: authToken,
});

export const db = drizzle(client, { schema });
