#!/usr/bin/env node
/**
 * Publishes the local data/*.tar.gz files to a GitHub Release.
 *
 * Usage:
 *   node scripts/publish-data.mjs <tag> [--draft] [--notes "..."]
 *
 * Requires:
 *   - `gh` CLI installed and authenticated (`gh auth status`)
 *   - data/ directory populated with state .tar.gz files
 *
 * Behavior:
 *   1. Creates the release with `gh release create <tag>` (idempotent: if the
 *      release already exists, falls through to upload).
 *   2. Uploads every data/*.tar.gz as a release asset. `--clobber` overwrites
 *      any existing asset with the same name, so re-runs are safe.
 *   3. Prints the release URL at the end.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = new URL('../data/', import.meta.url).pathname;

function gh(args) {
	const result = spawnSync('gh', args, { stdio: 'inherit' });
	if (result.status !== 0) {
		throw new Error(`gh ${args.join(' ')} exited with status ${result.status}`);
	}
}

function ghQuiet(args) {
	return spawnSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' });
}

const [, , tag, ...rest] = process.argv;
if (!tag) {
	console.error('Usage: node scripts/publish-data.mjs <tag> [--draft] [--notes "..."]');
	process.exit(1);
}

if (!existsSync(DATA_DIR)) {
	console.error(`data/ directory not found at ${DATA_DIR}`);
	process.exit(1);
}

const tarballs = readdirSync(DATA_DIR)
	.filter((f) => f.endsWith('.tar.gz'))
	.map((f) => join(DATA_DIR, f));

if (tarballs.length === 0) {
	console.error(`No .tar.gz files found in ${DATA_DIR}`);
	process.exit(1);
}

console.log(`Publishing ${tarballs.length} tarballs to release ${tag}…`);

const existing = ghQuiet(['release', 'view', tag]);
if (existing.status !== 0) {
	const draftArgs = rest.includes('--draft') ? ['--draft'] : [];
	const notesIdx = rest.indexOf('--notes');
	const notesArgs =
		notesIdx >= 0 && rest[notesIdx + 1]
			? ['--notes', rest[notesIdx + 1]]
			: ['--notes', `Data release ${tag}`];
	gh(['release', 'create', tag, '--title', tag, ...notesArgs, ...draftArgs]);
} else {
	console.log(`Release ${tag} already exists — uploading assets with --clobber.`);
}

let totalBytes = 0;
for (const tarball of tarballs) {
	totalBytes += statSync(tarball).size;
}
console.log(`Uploading ${(totalBytes / 1024 / 1024).toFixed(1)} MB across ${tarballs.length} files…`);

gh(['release', 'upload', tag, ...tarballs, '--clobber']);

const urlResult = ghQuiet(['release', 'view', tag, '--json', 'url', '--jq', '.url']);
const url = urlResult.status === 0 ? urlResult.stdout.trim() : '(check the repo\'s releases page)';
console.log(`\nDone. Release: ${url}`);
