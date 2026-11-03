import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { CapacitorHttp } from '@capacitor/core';
import { ANDROID_REDIRECT, createPkce, callbackCode, isAndroidCallback } from './oauth.mjs';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  username?: string;
  error?: unknown;
}

export async function nativeSignIn(clientId: string, portalUrl: string) {
  const pkce = await createPkce();
  let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let consumed = false;
  try {
    return await new Promise<{ token: string; userId?: string; expires: number }>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Die Anmeldung wurde nicht abgeschlossen. Bitte erneut versuchen.')), 5 * 60 * 1000);
      void App.addListener('appUrlOpen', event => {
        if (consumed || !isAndroidCallback(event.url)) return;
        consumed = true;
        void (async () => {
          const code = callbackCode(event.url, pkce.state);
          const body = new URLSearchParams({
            f: 'json', grant_type: 'authorization_code', client_id: clientId,
            code, code_verifier: pkce.verifier, redirect_uri: ANDROID_REDIRECT,
          });
          const response = await CapacitorHttp.post({
            url: `${portalUrl}/sharing/rest/oauth2/token`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body.toString(),
            connectTimeout: 20000, readTimeout: 30000,
          });
          const data: TokenResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          if (response.status !== 200 || data.error || !data.access_token) {
            throw new Error('ArcGIS konnte die Anmeldung nicht abschließen. Client ID und die registrierte Android-Redirect-URL prüfen.');
          }
          if (!Number.isFinite(data.expires_in) || Number(data.expires_in) <= 0) throw new Error('Ungültige Gültigkeitsdauer der ArcGIS-Anmeldung.');
          resolve({ token: data.access_token, userId: data.username, expires: Date.now() + Number(data.expires_in) * 1000 });
        })().catch(reject);
      }).then(async handle => {
        listener = handle;
        const authorize = new URL(`${portalUrl}/sharing/rest/oauth2/authorize`);
        authorize.search = new URLSearchParams({
          client_id: clientId, response_type: 'code', redirect_uri: ANDROID_REDIRECT,
          code_challenge: pkce.challenge, code_challenge_method: 'S256', state: pkce.state,
        }).toString();
        await Browser.open({ url: authorize.toString(), toolbarColor: '#214d40' });
      }).catch(reject);
    });
  } finally {
    if (timeout) clearTimeout(timeout);
    await listener?.remove();
    await Browser.close().catch(() => {});
  }
}
