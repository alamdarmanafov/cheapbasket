#!/usr/bin/env node
/**
 * Generates the "Secret Key (for OAuth)" Supabase needs for Sign in with Apple.
 * Runs locally with Node ≥ 18, no dependencies; the .p8 never leaves your machine.
 *
 *   node scripts/apple-secret.mjs --team TEAMID1234 --key-id KEYID12345 \
 *        --client-id az.cheapbasket.web --p8 ./AuthKey_KEYID12345.p8
 *
 * Paste the printed token into Supabase → Authentication → Providers → Apple → Secret Key.
 * Apple limits the token to 6 months: re-run and paste again before it expires.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : [])).filter((x) => x.length));
const { team, 'key-id': keyId, 'client-id': clientId = 'az.cheapbasket.web', p8 } = args;
if (!team || !keyId || !p8) {
  console.error('Usage: node scripts/apple-secret.mjs --team TEAMID --key-id KEYID --client-id az.cheapbasket.web --p8 ./AuthKey.p8');
  process.exit(1);
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = { iss: team, iat: now, exp: now + 60 * 60 * 24 * 180, aud: 'https://appleid.apple.com', sub: clientId };
const signingInput = `${b64(header)}.${b64(payload)}`;
const key = crypto.createPrivateKey(fs.readFileSync(p8, 'utf8'));
const signature = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
const token = `${signingInput}.${signature.toString('base64url')}`;

console.log('\nApple client secret (valid until ' + new Date(payload.exp * 1000).toISOString().slice(0, 10) + '):\n');
console.log(token + '\n');
