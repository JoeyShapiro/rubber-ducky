import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Connect to default db to create rubber_ducky if it doesn't exist
const admin = postgres({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

await admin`CREATE DATABASE rubber_ducky`.catch((e) => {
    if (!e.message.includes('already exists')) throw e;
});
await admin.end();

const client = postgres({
    host: 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

const db = drizzle(client);
await client`CREATE EXTENSION IF NOT EXISTS vector`;
await migrate(db, { migrationsFolder: 'drizzle' });
await client.end();
