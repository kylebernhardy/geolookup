/**
 * Lowercase names of every state/territory archive published in the default
 * data release. Used to resolve `autoLoadStates: 'all'` in plugin config.
 *
 * Names match the `.tar.gz` filenames in the GitHub Release exactly — multi-word
 * names use a literal space (URL-encoded at fetch time by buildTarUrl).
 */
export const AVAILABLE_STATES: readonly string[] = Object.freeze([
	'alabama',
	'alaska',
	'american samoa',
	'arizona',
	'arkansas',
	'california',
	'cnmi',
	'colorado',
	'connecticut',
	'dc',
	'delaware',
	'florida',
	'georgia',
	'guam',
	'hawaii',
	'idaho',
	'illinois',
	'indiana',
	'iowa',
	'kansas',
	'kentucky',
	'louisiana',
	'maine',
	'maryland',
	'massachusetts',
	'michigan',
	'minnesota',
	'mississippi',
	'missouri',
	'montana',
	'nebraska',
	'nevada',
	'new hampshire',
	'new jersey',
	'new mexico',
	'new york',
	'north carolina',
	'north dakota',
	'ohio',
	'oklahoma',
	'oregon',
	'pennsylvania',
	'puerto rico',
	'rhode island',
	'south carolina',
	'south dakota',
	'tennessee',
	'texas',
	'usvi',
	'utah',
	'vermont',
	'virginia',
	'washington',
	'west virginia',
	'wisconsin',
	'wyoming',
]);

/**
 * Resolves an `autoLoadStates` config value into a concrete list of lowercase
 * state names. Pass `'all'` for every available state, or an array of names
 * (case-insensitive — normalized to lowercase here).
 */
export function resolveAutoLoadStates(value: string[] | 'all' | undefined): string[] {
	if (!value) return [];
	if (value === 'all') return [...AVAILABLE_STATES];
	return value.map((s) => s.toLowerCase());
}
