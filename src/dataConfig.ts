/** Default GitHub release tag used to fetch state data archives. Bump when publishing a new data revision. */
export const DEFAULT_DATA_VERSION = 'data-2026.05';

/** Default base URL for state data archive downloads. */
export const DEFAULT_DATA_BASE_URL = 'https://github.com/kylebernhardy/geolookup/releases/download';

export interface BuildTarUrlOptions {
	dataVersion?: string;
	dataBaseUrl?: string;
}

/**
 * Builds the download URL for a state archive.
 *
 * @param state - Lowercase state/territory name (may contain spaces; URL-encoded internally)
 * @param opts - Optional overrides for base URL and data version
 * @returns Fully-qualified URL to the .tar.gz asset
 */
export function buildTarUrl(state: string, opts: BuildTarUrlOptions = {}): string {
	const base = (opts.dataBaseUrl ?? DEFAULT_DATA_BASE_URL).replace(/\/+$/, '');
	const version = opts.dataVersion ?? DEFAULT_DATA_VERSION;
	const encodedState = encodeURIComponent(state);
	return `${base}/${version}/${encodedState}.tar.gz`;
}
