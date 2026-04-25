import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { POSTGRES_PASSWORD } from '$env/static/private';

const client = postgres({
    host: 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: POSTGRES_PASSWORD,
});

export const db = drizzle(client, { schema });
