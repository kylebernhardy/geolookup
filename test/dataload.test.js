import assert from 'node:assert/strict';
import { test, mock, beforeEach } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The DataLoad resource depends on Harper globals (Resource, databases, transaction)
// and runs background processing. We test the get() validation logic by recreating
// the class with the same contract, mocking the Harper dependencies.

const DATA_DIR = new URL('../data/', import.meta.url).pathname;

// Track calls to mocked Harper tables
let putCalls = [];
let patchCalls = [];

function createMockTarget(params = {}) {
	return {
		get(key) { return params[key] ?? null; },
	};
}

function createDataLoad() {
	putCalls = [];
	patchCalls = [];

	const mockDataLoadJob = {
		put: mock.fn(async (id, data) => { putCalls.push({ id, data }); }),
		patch: mock.fn(async (id, data) => { patchCalls.push({ id, data }); }),
	};

	// Recreate the get() logic from DataLoad to test validation and job creation
	// without requiring the Harper runtime
	class DataLoad {
		async get(target) {
			const state = target.get('state');
			if (!state) {
				return { error: 'state query parameter is required' };
			}

			const stateLower = state.toLowerCase();
			const tarPath = join(DATA_DIR, `${stateLower}.tar.gz`);
			if (!existsSync(tarPath)) {
				return { error: `No data file found for state: ${stateLower}` };
			}

			const jobId = 'test-uuid';
			await mockDataLoadJob.put(jobId, {
				state: stateLower,
				status: 'pending',
				location_count: 0,
				cell_count: 0,
				started_at: new Date().toISOString(),
			});

			return { jobId };
		}
	}

	return { DataLoad, mockDataLoadJob };
}

test('returns error when state param is missing', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({}));
	assert.deepStrictEqual(result, { error: 'state query parameter is required' });
});

test('returns error when state param is null', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: null }));
	assert.deepStrictEqual(result, { error: 'state query parameter is required' });
});

test('returns error when tar file does not exist', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: 'Nonexistent' }));
	assert.ok(result.error.includes('No data file found'));
	assert.ok(result.error.includes('nonexistent'), 'should lowercase the state name in error');
});

test('lowercases state name', async () => {
	const { DataLoad, mockDataLoadJob } = createDataLoad();
	const dl = new DataLoad();
	// Wyoming exists in the data directory
	const result = await dl.get(createMockTarget({ state: 'WYOMING' }));
	assert.ok(result.jobId, 'should return a jobId');
	assert.equal(putCalls.length, 1);
	assert.equal(putCalls[0].data.state, 'wyoming');
});

test('returns jobId for valid state', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: 'wyoming' }));
	assert.ok(result.jobId);
	assert.equal(typeof result.jobId, 'string');
});

test('creates job record with correct initial values', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	await dl.get(createMockTarget({ state: 'Wyoming' }));

	assert.equal(putCalls.length, 1);
	const job = putCalls[0].data;
	assert.equal(job.state, 'wyoming');
	assert.equal(job.status, 'pending');
	assert.equal(job.location_count, 0);
	assert.equal(job.cell_count, 0);
	assert.ok(job.started_at, 'should have a started_at timestamp');
});

test('does not create job when state is missing', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	await dl.get(createMockTarget({}));
	assert.equal(putCalls.length, 0);
});

test('does not create job when tar file does not exist', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	await dl.get(createMockTarget({ state: 'Atlantis' }));
	assert.equal(putCalls.length, 0);
});

test('handles state names with spaces', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: 'New York' }));
	assert.ok(result.jobId, 'should return a jobId for multi-word state');
	assert.equal(putCalls[0].data.state, 'new york');
});

test('handles mixed case state names with spaces', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: 'NEW JERSEY' }));
	assert.ok(result.jobId);
	assert.equal(putCalls[0].data.state, 'new jersey');
});

test('handles territory names', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();

	const result = await dl.get(createMockTarget({ state: 'Puerto Rico' }));
	assert.ok(result.jobId);
	assert.equal(putCalls[0].data.state, 'puerto rico');
});

test('handles abbreviation territories', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();

	const result = await dl.get(createMockTarget({ state: 'DC' }));
	assert.ok(result.jobId);
	assert.equal(putCalls[0].data.state, 'dc');
});
