import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTarUrl, DEFAULT_DATA_BASE_URL, DEFAULT_DATA_VERSION } from '../src/dataConfig.ts';

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
