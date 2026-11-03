export const ANDROID_REDIRECT = 'de.thbingen.campus://oauth/callback';

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge, state };
}

export function isAndroidCallback(value) {
  try {
    const url = new URL(value);
    const expected = new URL(ANDROID_REDIRECT);
    return url.protocol === expected.protocol && url.host === expected.host && url.pathname === expected.pathname;
  } catch { return false; }
}

export function callbackCode(value, expectedState) {
  if (!isAndroidCallback(value)) throw new Error('Unbekannte Anmelde-Rücksprungadresse.');
  const url = new URL(value);
  if (!expectedState || url.searchParams.get('state') !== expectedState) throw new Error('Der Anmeldevorgang passt nicht zu dieser Sitzung. Bitte erneut anmelden.');
  if (url.searchParams.has('error')) throw new Error('Die ArcGIS-Anmeldung wurde abgelehnt oder abgebrochen.');
  const code = url.searchParams.get('code');
  if (!code) throw new Error('ArcGIS hat keinen Anmeldecode zurückgegeben.');
  return code;
}
