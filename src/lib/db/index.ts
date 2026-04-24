import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres({
    host: 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

export const db = drizzle(client, { schema });
