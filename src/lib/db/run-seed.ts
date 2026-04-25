import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { seed } from './seed';

const client = postgres({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

const db = drizzle(client, { schema });

await seed(db);
await client.end();
