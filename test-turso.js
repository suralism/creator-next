import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

async function main() {
  console.log("Connecting to", process.env.TURSO_DB_URL);
  const rs = await client.execute("SELECT 1 AS ok");
  console.log("Success:", rs.rows);
}

main().catch(console.error);
