import {Geolookup} from './resources/Geolookup.js';
import {DataLoad, configureDataLoad, isStateLoaded, kickoffLoad} from './resources/DataLoad.js';
import {Scope} from 'harper';
import type {GeolookupConfig} from "./types.js";
import {resolveAutoLoadStates} from './availableStates.js';
export {Geolookup, DataLoad};
export type {Location, Cell} from './types.js';
export type {RequestTarget} from './types.js'
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

    // Wire data-fetch config into DataLoad regardless of whether the endpoint
    // is exposed — DataLoad may be invoked programmatically too.
    configureDataLoad({
        dataVersion: options.dataVersion,
        dataBaseUrl: options.dataBaseUrl,
    });

    if (options.exposeGeoService) {
        scope.resources.set(options.geoServiceName, Geolookup);
    }

    if (options.exposeDataLoadService) {
        scope.resources.set(options.dataLoadServiceName, DataLoad);
    }

    // Auto-load configured states in the background. Fire-and-forget so plugin
    // init never blocks Harper startup, and a failed load (bad name, 404 from
    // GitHub Releases, transient network) lands on its DataLoadJob record
    // rather than crashing boot.
    const statesToAutoLoad = resolveAutoLoadStates(options.autoLoadStates);
    if (statesToAutoLoad.length > 0) {
        queueMicrotask(() => {
            void Promise.all(
                statesToAutoLoad.map(async (state) => {
                    if (await isStateLoaded(state)) return;
                    await kickoffLoad(state);
                }),
            ).catch(() => {});
        });
    }
}
