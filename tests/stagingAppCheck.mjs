// A short-lived staging-only debug credential for non-browser integration tests.
// Never bundle this helper or its credentials into the website.
import { randomUUID } from 'node:crypto';
export async function stagingAppCheck(config, ownerToken) {
  if (process.env.ALLOW_DISPOSABLE_STAGING_TESTS !== 'true' || config.VITE_FIREBASE_PROJECT_ID !== 'leadership-skill-builder-stg') throw Error('Disposable staging test opt-in required.');
  const parent = 'projects/600309447137/apps/' + config.VITE_FIREBASE_APP_ID;
  const root = 'https://firebaseappcheck.googleapis.com/v1/';
  const debugToken = randomUUID();
  const headers = { Authorization: 'Bearer ' + ownerToken, 'x-goog-user-project': 'leadership-skill-builder-stg', 'Content-Type': 'application/json' };
  const created = await fetch(root + parent + '/debugTokens', { method: 'POST', headers, body: JSON.stringify({ displayName: 'Disposable integration ' + Date.now(), token: debugToken }) });
  if (!created.ok) throw Error('Could not register disposable staging App Check test credential: ' + created.status);
  const { name } = await created.json();
  const cleanup = async () => {
    const r = await fetch(root + name, { method: 'DELETE', headers });
    if (!r.ok && r.status !== 404) throw Error('Could not remove disposable App Check credential: ' + r.status);
  };
  try {
    const exchanged = await fetch(root + parent + ':exchangeDebugToken?key=' + config.VITE_FIREBASE_API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debugToken }) });
    if (!exchanged.ok) throw Error('Could not exchange staging App Check test credential: ' + exchanged.status);
    const { token } = await exchanged.json();
    return { token, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
