import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.TESSERA_TEST_URL;
assert.ok(base, 'TESSERA_TEST_URL is required');
const expected = process.env.GITHUB_SHA;
assert.ok(expected, 'GITHUB_SHA is required');
let published, lastError;
for (let attempt = 0; attempt < 24; attempt++) {
    try {
        const url = new URL('build-info.json', base);
        url.searchParams.set('commit', expected);
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200);
        published = await response.json();
        assert.equal(published.storage, 'browser-local');
        assert.equal(published.commit, expected);
        lastError = null;
        break;
    } catch (error) {
        lastError = error;
        await delay(5000);
    }
}
if (lastError) throw lastError;
console.log('Verified published Pages build:', JSON.stringify(published));
