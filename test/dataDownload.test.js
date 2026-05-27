import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTarUrl, DEFAULT_DATA_BASE_URL, DEFAULT_DATA_VERSION } from '../src/dataConfig.ts';
import { downloadStateTar, extractStateTar } from '../src/resources/dataDownload.ts';

test('buildTarUrl composes default URL', () => {
	const url = buildTarUrl('colorado');
	assert.equal(url, `${DEFAULT_DATA_BASE_URL}/${DEFAULT_DATA_VERSION}/colorado.tar.gz`);
});

test('buildTarUrl URL-encodes state names with spaces', () => {
	const url = buildTarUrl('new york');
	assert.match(url, /\/new%20york\.tar\.gz$/);
});

test('buildTarUrl honors overridden base + version', () => {
	const url = buildTarUrl('utah', { dataVersion: 'data-test', dataBaseUrl: 'https://example.test/r' });
	assert.equal(url, 'https://example.test/r/data-test/utah.tar.gz');
});

test('buildTarUrl strips trailing slash from custom base URL', () => {
	const url = buildTarUrl('utah', { dataBaseUrl: 'https://example.test/r/' });
	assert.equal(url, `https://example.test/r/${DEFAULT_DATA_VERSION}/utah.tar.gz`);
});

test('extractStateTar unpacks a tar.gz into the target directory', async () => {
	const workDir = await mkdtemp(join(tmpdir(), 'geolookup-test-'));
	try {
		await extractStateTar(new URL('./fixtures/tiny-state.tar.gz', import.meta.url).pathname, workDir);
		const locations = JSON.parse(await readFile(join(workDir, 'tinyland/Location/locations.json'), 'utf-8'));
		assert.equal(locations[0].id, 'loc-1');
		const cells = JSON.parse(await readFile(join(workDir, 'tinyland/Cell/cells.json'), 'utf-8'));
		assert.equal(cells[0].h3_index, '892a1072023ffff');
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
});

test('downloadStateTar writes the response body to disk', async () => {
	const workDir = await mkdtemp(join(tmpdir(), 'geolookup-test-'));
	const destPath = join(workDir, 'sample.tar.gz');
	const fixturePath = new URL('./fixtures/tiny-state.tar.gz', import.meta.url).pathname;
	const fixtureBytes = await readFile(fixturePath);

	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url) => {
		assert.equal(url, 'https://example.test/sample.tar.gz');
		return new Response(fixtureBytes, { status: 200 });
	};
	try {
		await downloadStateTar('https://example.test/sample.tar.gz', destPath);
		const written = await readFile(destPath);
		assert.equal(written.length, fixtureBytes.length);
	} finally {
		globalThis.fetch = originalFetch;
		await rm(workDir, { recursive: true, force: true });
	}
});

test('downloadStateTar throws on non-2xx response', async () => {
	const workDir = await mkdtemp(join(tmpdir(), 'geolookup-test-'));
	const destPath = join(workDir, 'sample.tar.gz');
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response('not found', { status: 404 });
	try {
		await assert.rejects(
			() => downloadStateTar('https://example.test/missing.tar.gz', destPath),
			/404/,
		);
	} finally {
		globalThis.fetch = originalFetch;
		await rm(workDir, { recursive: true, force: true });
	}
});
