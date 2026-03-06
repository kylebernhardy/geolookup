import { databases } from 'harperdb';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const { Location, Cell, DataLoadJob } = databases.geolookup;
const DATA_DIR = new URL('../../data/', import.meta.url).pathname;

/**
 * Reads all JSON files from a directory and loads each file's records into the
 * given Harper table within a transaction. Each JSON file is expected to contain
 * an array of records. After each file is loaded, the DataLoadJob record is
 * updated with the running count.
 *
 * @param dir - Absolute path to the directory containing JSON files
 * @param table - Harper table instance to load records into
 * @param idField - Name of the field to use as the record's primary key
 * @param jobId - UUID of the DataLoadJob record to update with progress
 * @param countField - Name of the count field to update on the job (e.g. 'location_count')
 * @returns Total number of records loaded across all files
 */
async function loadTableFiles(dir: string, table: any, idField: string, jobId: string, countField: string) {
	let count = 0;
	if (!existsSync(dir)) return count;

	const files = readdirSync(dir).filter(f => f.endsWith('.json'));
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
 * Runs data extraction and loading in the background. Updates the DataLoadJob
 * record as it progresses through each step:
 *   extracting → loading_locations → loading_cells → completed (or error)
 *
 * On success, marks the job as completed with final counts and duration.
 * On error, marks the job with status "error" and captures the error message.
 * The extracted state folder is always cleaned up, even on failure.
 *
 * Locations are loaded before Cells because Cell records reference Location IDs
 * via their tier_1/tier_2/tier_3 foreign keys.
 *
 * @param jobId - UUID of the DataLoadJob record to update
 * @param state - Lowercase state name (matches the extracted directory name)
 * @param tarPath - Absolute path to the .tar.gz archive
 */
async function processDataLoad(jobId: string, state: string, tarPath: string) {
	const startTime = Date.now();
	let locationCount = 0;
	let cellCount = 0;

	try {
		// Uses execFileSync (no shell) to avoid injection risks
		await DataLoadJob.patch(jobId, { status: 'extracting' });
		execFileSync('tar', ['-xzf', tarPath, '-C', DATA_DIR]);

		const stateDir = join(DATA_DIR, state);
		if (!existsSync(stateDir)) {
			throw new Error(`Expected directory ${state} not found after extraction`);
		}

		try {
			await DataLoadJob.patch(jobId, { status: 'loading_locations' });
			locationCount = await loadTableFiles(join(stateDir, 'Location'), Location, 'id', jobId, 'location_count');

			await DataLoadJob.patch(jobId, { status: 'loading_cells' });
			cellCount = await loadTableFiles(join(stateDir, 'Cell'), Cell, 'h3_index', jobId, 'cell_count');
		} finally {
			// Always clean up the extracted folder, even if loading fails partway through
			rmSync(stateDir, { recursive: true, force: true });
		}

		const durationMs = Date.now() - startTime;
		await DataLoadJob.patch(jobId, {
			status: 'completed',
			location_count: locationCount,
			cell_count: cellCount,
			completed_at: new Date().toISOString(),
			duration_ms: durationMs,
		});
	} catch (err) {
		const durationMs = Date.now() - startTime;
		await DataLoadJob.patch(jobId, {
			status: 'error',
			error_message: err.message,
			location_count: locationCount,
			cell_count: cellCount,
			completed_at: new Date().toISOString(),
			duration_ms: durationMs,
		});
	}
}

/**
 * Async bulk loading endpoint for populating Location and Cell tables from
 * pre-packaged state data files. Validates the request, creates a DataLoadJob
 * record for tracking, and returns the job ID immediately. The actual data
 * extraction and loading runs in the background — callers poll the DataLoadJob
 * table to check progress.
 */
export class DataLoad extends Resource {
	/**
	 * Handles GET requests to initiate a data load job.
	 *
	 * Validates the state parameter, checks that the corresponding .tar.gz file
	 * exists, creates a DataLoadJob record, and kicks off background processing.
	 * Returns the job ID immediately so the caller can poll for progress.
	 *
	 * @param target - Harper request target containing query parameters
	 * @returns Object with jobId on success, or an error object on validation failure
	 */
	async get(target) {
		const state = target.get('state');
		if (!state) {
			return { error: 'state query parameter is required' };
		}

		// Normalize to lowercase to match the tar.gz filenames in the data directory
		const stateLower = state.toLowerCase();
		const tarPath = join(DATA_DIR, `${stateLower}.tar.gz`);
		if (!existsSync(tarPath)) {
			return { error: `No data file found for state: ${stateLower}` };
		}

		// Create the job record and return the ID to the caller immediately
		const jobId = randomUUID();
		await DataLoadJob.put(jobId, {
			state: stateLower,
			status: 'pending',
			location_count: 0,
			cell_count: 0,
			started_at: new Date().toISOString(),
		});

		// Fire and forget — errors are captured in the job record, .catch() prevents
		// unhandled rejection if the DataLoadJob.patch itself fails in the catch block
		processDataLoad(jobId, stateLower, tarPath).catch(() => {});

		return { jobId };
	}
}
