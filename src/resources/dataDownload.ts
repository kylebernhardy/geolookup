import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extract as tarExtract } from 'tar';

/**
 * Downloads a tar.gz archive to a local file path.
 * Throws if the HTTP response is not 2xx or has no body.
 *
 * @param url - Fully-qualified URL of the archive
 * @param destPath - Absolute path the archive will be written to
 */
export async function downloadStateTar(url: string, destPath: string): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
	}
	if (!res.body) {
		throw new Error(`Failed to download ${url}: empty response body`);
	}
	await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

/**
 * Extracts a tar.gz archive into the target directory using node-tar.
 *
 * @param tarPath - Absolute path to the .tar.gz file
 * @param destDir - Absolute path to the directory that will receive the extracted contents
 */
export async function extractStateTar(tarPath: string, destDir: string): Promise<void> {
	await tarExtract({ file: tarPath, cwd: destDir });
}
