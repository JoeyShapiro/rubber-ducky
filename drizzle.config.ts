import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/lib/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: 5432,
        database: 'rubber_ducky',
        user: 'postgres',
        password: process.env.POSTGRES_PASSWORD,
    },
});
