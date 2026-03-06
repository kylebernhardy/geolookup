

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