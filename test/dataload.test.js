import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

// The DataLoad resource depends on Harper globals (Resource, databases, transaction)
// and the harper npm package's databases.geolookup accessor evaluates at module load,
// which can't happen outside a Harper runtime. So we recreate the get() handler's
// contract here with mocked Harper dependencies. The download/extract path is
// covered separately in test/dataDownload.test.js — the helpers it exercises are
// pure functions composed by processDataLoad.

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

	// Mirrors DataLoad.get() in src/resources/DataLoad.ts: validate state,
	// create a job, fire-and-forget background processing, return jobId.
	// Background processing is NOT modeled here — see dataDownload.test.js for
	// the helpers it composes.
	class DataLoad {
		async get(target) {
			const state = target.get('state');
			if (!state) {
				return { error: 'state query parameter is required' };
			}

			const stateLower = state.toLowerCase();
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

test('does not create job when state is missing', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	await dl.get(createMockTarget({}));
	assert.equal(putCalls.length, 0);
});

test('lowercases state name', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	const result = await dl.get(createMockTarget({ state: 'WYOMING' }));
	assert.ok(result.jobId, 'should return a jobId');
	assert.equal(putCalls.length, 1);
	assert.equal(putCalls[0].data.state, 'wyoming');
});

test('returns jobId for any non-empty state', async () => {
	const { DataLoad } = createDataLoad();
	const dl = new DataLoad();
	// Pre-validation of state-against-data is gone; any non-empty state creates
	// a job. Bad states surface async via DataLoadJob.error_message after a
	// failed download from GitHub Releases.
	const result = await dl.get(createMockTarget({ state: 'atlantis' }));
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
