import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTiers } from '../resources/Geolookup.ts';

test('parseTiers returns all tiers when no param provided', () => {
	const result = parseTiers(undefined);
	assert.deepStrictEqual(result, new Set(['1', '2', '3']));
});

test('parseTiers returns all tiers for "all"', () => {
	const result = parseTiers('all');
	assert.deepStrictEqual(result, new Set(['1', '2', '3']));
});

test('parseTiers returns single tier', () => {
	assert.deepStrictEqual(parseTiers('1'), new Set(['1']));
	assert.deepStrictEqual(parseTiers('2'), new Set(['2']));
	assert.deepStrictEqual(parseTiers('3'), new Set(['3']));
});

test('parseTiers returns multiple tiers', () => {
	assert.deepStrictEqual(parseTiers('1,3'), new Set(['1', '3']));
	assert.deepStrictEqual(parseTiers('1,2,3'), new Set(['1', '2', '3']));
	assert.deepStrictEqual(parseTiers('2,3'), new Set(['2', '3']));
});

test('parseTiers trims whitespace', () => {
	assert.deepStrictEqual(parseTiers('1, 3'), new Set(['1', '3']));
});

test('parseTiers returns error for invalid tier', () => {
	const result = parseTiers('4');
	assert.ok('error' in result);
	assert.match(result.error, /Invalid tier/);
});

test('parseTiers returns error for mixed valid and invalid tiers', () => {
	const result = parseTiers('1,5');
	assert.ok('error' in result);
	assert.match(result.error, /5/);
});
