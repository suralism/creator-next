import 'dotenv/config';

export default {
    schema: './src/lib/schema.js',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.TURSO_DB_URL,
        authToken: process.env.TURSO_DB_AUTH_TOKEN,
    },
};
