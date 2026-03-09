import { latLngToCell, cellToParent } from 'h3-js';
import { databases } from 'harperdb';
import type { Location, Cell as CellType } from '../types.ts';
const { Location, Cell } = databases.geolookup;

// Tiers map to US administrative hierarchy levels:
//   '1' = place (city/town), '2' = county_subdivision (township/MCD), '3' = county
const VALID_TIERS = new Set(['1', '2', '3']);

// Fields returned for each matched Location in the lookup response
const LOCATION_SELECT = ['id', 'tier', 'name', 'name_full', 'state_name', 'state_abbrev', 'h3_index', 'country_code', 'county_name'];

/**
 * Parses the "tiers" query param into a set of tier strings.
 * Accepts comma-separated values ("1,3"), "all", or undefined (defaults to all tiers).
 *
 * @param tiersParam - Raw tiers query parameter value
 * @returns A Set of valid tier strings, or an error object if any requested tier is invalid
 */
export function parseTiers(tiersParam: string | undefined): Set<string> | { error: string } {
	if (!tiersParam || tiersParam === 'all') {
		return new Set(VALID_TIERS);
	}
	const requested = tiersParam.split(',').map(t => t.trim());
	const invalid = requested.filter(t => !VALID_TIERS.has(t));
	if (invalid.length > 0) {
		return { error: `Invalid tier(s): ${invalid.join(', ')}. Valid values are 1, 2, 3, or all.` };
	}
	return new Set(requested);
}

/**
 * Reverse geocoding resource. Given a lat/lon coordinate, finds the best matching
 * Location at each requested tier by searching H3 cells across multiple resolutions.
 */
export class Geolookup extends Resource {
	/**
	 * Handles GET requests. Validates lat/lon/tiers query params, then delegates
	 * to _lookup for the actual H3-based spatial search.
	 *
	 * @param target - Harper request target containing query parameters
	 * @returns Lookup results keyed by tier name, or an error object
	 */
	get(target) {
		const lat = parseFloat(target.get('lat'));
		const lon = parseFloat(target.get('lon'));

		if (isNaN(lat) || isNaN(lon)) {
			return { error: 'lat and lon query parameters are required' };
		}

		const tiers = parseTiers(target.get('tiers'));
		if ('error' in tiers) {
			return tiers;
		}

		return this._lookup(lat, lon, tiers);
	}

	/**
	 * Core reverse geocoding logic.
	 *
	 * 1. Converts lat/lon to an H3 cell at the finest resolution (9).
	 * 2. Builds a candidate set of H3 indexes: the resolution-9 cell plus its parent
	 *    at each coarser resolution (8 down to 2). This is necessary because cells
	 *    are stored in compact form — a match could be at any resolution level.
	 * 3. Searches the Cell table for any matching H3 index (OR across all candidates).
	 *    Only joins to Location records for the tiers the caller requested.
	 * 4. Collects the first Location found for each requested tier. Stops early once
	 *    all requested tiers have a match.
	 *
	 * @param lat - Latitude in decimal degrees
	 * @param lon - Longitude in decimal degrees
	 * @param tiers - Set of tier strings to search for ("1", "2", "3")
	 * @returns Object keyed by tier name (place, county_subdivision, county) with matched Locations
	 */
	async _lookup(lat: number, lon: number, tiers: Set<string>) {
		const h3Index = latLngToCell(lat, lon, 9);
		const conditions = [{ attribute: 'h3_index', value: h3Index }];
		for (let res = 8; res >= 2; res--) {
			conditions.push({ attribute: 'h3_index', value: cellToParent(h3Index, res) });
		}

		// Only select relationship joins for the tiers we care about
		const select: (string | { name: string; select: string[] })[] = ['h3_index'];
		if (tiers.has('1')) select.push({ name: 'place', select: LOCATION_SELECT });
		if (tiers.has('2')) select.push({ name: 'county_subdivision', select: LOCATION_SELECT });
		if (tiers.has('3')) select.push({ name: 'county', select: LOCATION_SELECT });

		const result: Record<string, Location> = {};
		for await (const cell of Cell.search({
			select,
			conditions,
			operator: 'or',
		})) {
			if (tiers.has('1') && cell.place && !result.place) {
				result.place = cell.place;
			}
			if (tiers.has('2') && cell.county_subdivision && !result.county_subdivision) {
				result.county_subdivision = cell.county_subdivision;
			}
			if (tiers.has('3') && cell.county && !result.county) {
				result.county = cell.county;
			}
			// Early exit: stop scanning once every requested tier has been found
			if (Object.keys(result).length === tiers.size) {
				break;
			}
		}
		return result;
	}
}
