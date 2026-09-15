#!/usr/bin/env bun
// Computes the .env values (PASSWORD_HASH, PASSWORD_PEPPER) for the login password.
//
// Reuses deriveLoginKey - the exact function the browser runs - so there is one implementation
// of the PBKDF2 step, not a second one here that could quietly drift from it. From there this
// mirrors login/+server.ts: HMAC-pepper the derived key, then Argon2id it with Bun.password.
//
// Usage: bun hash-password.ts "<password>"
//
// Reuses PASSWORD_PEPPER from .env if it is already set. Changing the pepper invalidates every
// existing PASSWORD_HASH - do not regenerate it as a side effect of setting a new password.

import { randomBytes, createHmac } from 'node:crypto';
import dotenv from 'dotenv';
import { deriveLoginKey } from './src/lib/authConfig';

dotenv.config();

const password = process.argv[2];
if (!password) {
	console.error('Usage: bun hash-password.ts "<password>"');
	process.exit(1);
}

const pepper = process.env.PASSWORD_PEPPER || randomBytes(32).toString('hex');
const isNewPepper = !process.env.PASSWORD_PEPPER;

const derived = await deriveLoginKey(password);
const peppered = createHmac('sha256', pepper).update(derived).digest('hex');
const hash = await Bun.password.hash(peppered, 'argon2id');

console.log('Set these in .env:\n');
console.log(`PASSWORD_HASH=${hash}`);
console.log(`PASSWORD_PEPPER=${pepper}`);
if (isNewPepper) {
	console.log('\n(no PASSWORD_PEPPER was found in .env - this is a freshly generated one)');
}
