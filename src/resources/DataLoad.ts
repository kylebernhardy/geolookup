import {databases, RequestTarget} from 'harper';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildTarUrl } from '../dataConfig.js';
import { downloadStateTar, extractStateTar } from './dataDownload.js';

const { Location, Cell, DataLoadJob } = databases.geolookup;

/** Per-instance config injected by handleApplication() in src/index.ts. */
let runtimeConfig: { dataVersion?: string; dataBaseUrl?: string } = {};

/** Wires plugin config (dataVersion, dataBaseUrl) into DataLoad before the resource is used. */
export function configureDataLoad(opts: { dataVersion?: string; dataBaseUrl?: string }): void {
	runtimeConfig = { ...opts };
}

/**
 * Reads all JSON files from a directory and loads each file's records into the
 * given Harper table within a transaction. After each file is loaded, the
 * DataLoadJob record is updated with the running count.
 */
async function loadTableFiles(
	dir: string,
	table: { put(id: string, record: unknown, txn: unknown): Promise<void> },
	idField: string,
	jobId: string,
	countField: string,
) {
	let count = 0;
	if (!existsSync(dir)) return count;

	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
	for (const file of files) {
		const records = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
		await transaction(async (txn) => {
			for (const record of records) {
				await table.put(record[idField], record, txn);
				count++;
			}
		});
		await DataLoadJob.patch(jobId, { [countField]: count });
	}
	return count;
}

/**
 * Background worker for a single data load job. Status transitions:
 *   downloading → extracting → loading_locations → loading_cells → completed
 *   (or error at any stage; error_message captures detail)
 *
 * Each job runs in its own os.tmpdir() workspace which is removed in finally.
 * Locations load before Cells because Cell records reference Location IDs.
 */
async function processDataLoad(jobId: string, state: string) {
	const startTime = Date.now();
	let locationCount = 0;
	let cellCount = 0;
	const workDir = await mkdtemp(join(tmpdir(), `geolookup-${jobId}-`));
	const tarPath = join(workDir, `${state}.tar.gz`);
	const url = buildTarUrl(state, runtimeConfig);

	try {
		await DataLoadJob.patch(jobId, { status: 'downloading' });
		await downloadStateTar(url, tarPath);

		await DataLoadJob.patch(jobId, { status: 'extracting' });
		await extractStateTar(tarPath, workDir);

		const stateDir = join(workDir, state);
		if (!existsSync(stateDir)) {
			throw new Error(`Expected directory ${state} not found after extraction`);
		}

		await DataLoadJob.patch(jobId, { status: 'loading_locations' });
		locationCount = await loadTableFiles(join(stateDir, 'Location'), Location, 'id', jobId, 'location_count');

		await DataLoadJob.patch(jobId, { status: 'loading_cells' });
		cellCount = await loadTableFiles(join(stateDir, 'Cell'), Cell, 'h3_index', jobId, 'cell_count');

		await DataLoadJob.patch(jobId, {
			status: 'completed',
			location_count: locationCount,
			cell_count: cellCount,
			completed_at: new Date().toISOString(),
			duration_ms: Date.now() - startTime,
		});
	} catch (err: any) {
		await DataLoadJob.patch(jobId, {
			status: 'error',
			error_message: err.message,
			location_count: locationCount,
			cell_count: cellCount,
			completed_at: new Date().toISOString(),
			duration_ms: Date.now() - startTime,
		});
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

/**
 * Async bulk loading endpoint. Validates the request, creates a DataLoadJob
 * record for tracking, and returns the job ID immediately. The actual
 * download, extraction, and loading run in the background — poll
 * DataLoadJob to check progress and surface errors.
 */
export class DataLoad extends Resource {
	async get(target: RequestTarget) {
		const state = target.get('state');
		if (!state) {
			return { error: 'state query parameter is required' };
		}

		const stateLower = state.toLowerCase();
		const jobId = randomUUID();
		await DataLoadJob.put(jobId, {
			state: stateLower,
			status: 'pending',
			location_count: 0,
			cell_count: 0,
			started_at: new Date().toISOString(),
		});

		// Fire and forget — errors are captured in the job record. The .catch()
		// guards against an unhandled rejection if the patch in the catch block
		// itself fails (e.g. transient DB error).
		processDataLoad(jobId, stateLower).catch(() => {});

		return { jobId };
	}
}
