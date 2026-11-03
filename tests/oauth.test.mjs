import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ANDROID_REDIRECT, createPkce, callbackCode, isAndroidCallback } from '../src/oauth.mjs';

test('PKCE uses fresh, valid verifiers and SHA256 challenges', async () => {
  const a = await createPkce(), b = await createPkce();
  assert.match(a.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(a.challenge, createHash('sha256').update(a.verifier).digest('base64url'));
  assert.notEqual(a.verifier, b.verifier);
  assert.notEqual(a.state, b.state);
});
test('OAuth callback must match the exact scheme, host and path', () => {
  assert.equal(isAndroidCallback(`${ANDROID_REDIRECT}?code=example&state=valid`), true);
  for (const value of ['https://oauth/callback', 'de.thbingen.campus://other/callback', 'de.thbingen.campus://oauth/callback/evil', 'invalid']) assert.equal(isAndroidCallback(value), false);
});
test('OAuth rejects mismatched state, denial and absent codes', () => {
  assert.equal(callbackCode(`${ANDROID_REDIRECT}?code=example&state=valid`, 'valid'), 'example');
  assert.throws(() => callbackCode(`${ANDROID_REDIRECT}?code=example&state=other`, 'valid'));
  assert.throws(() => callbackCode(`${ANDROID_REDIRECT}?code=example`, 'valid'));
  assert.throws(() => callbackCode(`${ANDROID_REDIRECT}?error=access_denied&state=valid`, 'valid'));
  assert.throws(() => callbackCode(`${ANDROID_REDIRECT}?state=valid`, 'valid'));
});
