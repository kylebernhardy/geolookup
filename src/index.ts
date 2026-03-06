import {Geolookup} from './resources/Geolookup.ts';
import {DataLoad} from './resources/DataLoad.ts';
import {Scope} from 'harperdb';
import type {GeolookupConfig} from "./types.ts";
export {Geolookup, DataLoad};

/**
 * Plugin entry point called by Harper during startup.
 *
 * Reads configuration options from the consuming app's config.yaml and
 * conditionally registers resource endpoints. Services are only exposed
 * when their corresponding "expose" flag is set — this allows consuming
 * apps to use the Geolookup and DataLoad classes programmatically without
 * necessarily exposing them as REST endpoints.
 *
 * @param scope - Harper scope providing access to options and resource registration
 */
export function handleApplication(scope: Scope) {
    const options = (scope.options.getAll() || {}) as GeolookupConfig;

    if (options.exposeGeoService) {
        scope.resources.set(options.geoServiceName, Geolookup);
    }

    if (options.exposeDataLoadService) {
        scope.resources.set(options.dataLoadServiceName, DataLoad);
    }
}
