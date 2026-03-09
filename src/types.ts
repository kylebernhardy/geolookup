

/** Configuration options for the Geolookup plugin, provided via `config.yaml` in the consuming application. */
export interface GeolookupConfig {
    /** When truthy, registers the Geolookup resource as a REST endpoint at the path specified by `geoServiceName`. Defaults to `false`. */
    exposeGeoService?: boolean;

    /** The URL path segment for the Geolookup endpoint (e.g. `"geo"` exposes it at `/geo`). Required when `exposeGeoService` is `true`. */
    geoServiceName?: string;

    /** When truthy, registers the DataLoad resource as a REST endpoint at the path specified by `dataLoadServiceName`. Defaults to `false`. */
    exposeDataLoadService?: boolean;

    /** The URL path segment for the DataLoad endpoint (e.g. `"dataload"` exposes it at `/dataload`). Required when `exposeDataLoadService` is `true`. */
    dataLoadServiceName?: string;

}

export interface Location {
	id: string;
	tier: number;
	tier_label: string;
	name: string;
	name_full: string;
	feature_type: string;
	state_name: string;
	state_abbrev: string;
	lat: number;
	lon: number;
	h3_index: string;
	country_code: string;
	lsad: string;
	county_name: string;
	county_fips: string;
}

export interface Cell {
	h3_index: string;
	tier_1: string;
	tier_2: string;
	tier_3: string;
	county?: Location;
	county_subdivision?: Location;
	place?: Location;
}

export interface DataLoadJob {
	id: string;
	state: string;
	status: string;
	error_message: string;
	location_count: number;
	cell_count: number;
	started_at: string;
	completed_at: string;
	duration_ms: number;
}