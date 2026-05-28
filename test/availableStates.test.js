import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AVAILABLE_STATES, resolveAutoLoadStates } from '../src/availableStates.ts';

test('AVAILABLE_STATES contains exactly 56 entries (50 states + DC + 5 territories)', () => {
	assert.equal(AVAILABLE_STATES.length, 56);
});

test('AVAILABLE_STATES entries are all lowercase', () => {
	for (const state of AVAILABLE_STATES) {
		assert.equal(state, state.toLowerCase(), `${state} is not lowercase`);
	}
});

test('AVAILABLE_STATES includes known states + territories with spaces', () => {
	const must = ['alabama', 'wyoming', 'dc', 'new york', 'puerto rico', 'cnmi'];
	for (const s of must) {
		assert.ok(AVAILABLE_STATES.includes(s), `missing expected entry: ${s}`);
	}
});

test('AVAILABLE_STATES is sorted (helps with diffs and predictability)', () => {
	const sorted = [...AVAILABLE_STATES].sort();
	assert.deepStrictEqual([...AVAILABLE_STATES], sorted);
});

test('resolveAutoLoadStates: undefined → empty list', () => {
	assert.deepStrictEqual(resolveAutoLoadStates(undefined), []);
});

test('resolveAutoLoadStates: empty array → empty list', () => {
	assert.deepStrictEqual(resolveAutoLoadStates([]), []);
});

test('resolveAutoLoadStates: "all" → full AVAILABLE_STATES', () => {
	const result = resolveAutoLoadStates('all');
	assert.equal(result.length, AVAILABLE_STATES.length);
	assert.deepStrictEqual(result, [...AVAILABLE_STATES]);
});

test('resolveAutoLoadStates: "all" returns a fresh copy (not a reference)', () => {
	const result = resolveAutoLoadStates('all');
	// Mutating the returned array must not affect AVAILABLE_STATES
	result.push('moon');
	assert.equal(AVAILABLE_STATES.length, 56);
});

test('resolveAutoLoadStates: array entries are lowercased', () => {
	assert.deepStrictEqual(
		resolveAutoLoadStates(['DC', 'Colorado', 'NEW YORK', 'Puerto Rico']),
		['dc', 'colorado', 'new york', 'puerto rico'],
	);
});

test('resolveAutoLoadStates: passes through already-lowercase entries unchanged', () => {
	assert.deepStrictEqual(
		resolveAutoLoadStates(['dc', 'wyoming']),
		['dc', 'wyoming'],
	);
});
