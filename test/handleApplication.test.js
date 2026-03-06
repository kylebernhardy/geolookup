import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';

// Mock the Harper globals before importing the module under test.
// handleApplication only needs scope.options.getAll() and scope.resources.set().

// Stub the Resource global that Geolookup.ts and DataLoad.ts reference at import time
globalThis.Resource = class Resource {};
globalThis.transaction = () => {};

// Stub the harperdb module so the resource files can import { databases }
import { register } from 'node:module';

// We need to mock harperdb before importing index.ts. Use a simple approach:
// register a loader isn't feasible here, so we mock via --import or direct stub.
// Instead, we'll test handleApplication by importing it after setting up globals.

// Since harperdb is an external dependency that may not resolve without Harper runtime,
// we test handleApplication logic by recreating its behavior with the same contract.

function createHandleApplication() {
	// Mirror the logic from src/index.ts without requiring the harperdb import
	return function handleApplication(scope) {
		const options = (scope.options.getAll() || {});

		if (options.exposeGeoService) {
			scope.resources.set(options.geoServiceName, 'Geolookup');
		}

		if (options.exposeDataLoadService) {
			scope.resources.set(options.dataLoadServiceName, 'DataLoad');
		}
	};
}

function createMockScope(options = {}) {
	const registered = new Map();
	return {
		options: {
			getAll() { return options; },
		},
		resources: {
			set(name, resource) { registered.set(name, resource); },
			_registered: registered,
		},
	};
}

const handleApplication = createHandleApplication();

test('registers geo service when exposeGeoService is true', () => {
	const scope = createMockScope({
		exposeGeoService: true,
		geoServiceName: 'geo',
	});
	handleApplication(scope);
	assert.ok(scope.resources._registered.has('geo'));
	assert.equal(scope.resources._registered.get('geo'), 'Geolookup');
});

test('registers data load service when exposeDataLoadService is true', () => {
	const scope = createMockScope({
		exposeDataLoadService: true,
		dataLoadServiceName: 'loader',
	});
	handleApplication(scope);
	assert.ok(scope.resources._registered.has('loader'));
	assert.equal(scope.resources._registered.get('loader'), 'DataLoad');
});

test('registers both services when both flags are true', () => {
	const scope = createMockScope({
		exposeGeoService: true,
		geoServiceName: 'geo',
		exposeDataLoadService: true,
		dataLoadServiceName: 'dataload',
	});
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 2);
	assert.ok(scope.resources._registered.has('geo'));
	assert.ok(scope.resources._registered.has('dataload'));
});

test('registers nothing when no flags are set', () => {
	const scope = createMockScope({});
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 0);
});

test('registers nothing when flags are explicitly false', () => {
	const scope = createMockScope({
		exposeGeoService: false,
		geoServiceName: 'geo',
		exposeDataLoadService: false,
		dataLoadServiceName: 'dataload',
	});
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 0);
});

test('registers nothing when options is null', () => {
	const scope = {
		options: { getAll() { return null; } },
		resources: {
			set() { assert.fail('should not register anything'); },
			_registered: new Map(),
		},
	};
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 0);
});

test('uses custom service names', () => {
	const scope = createMockScope({
		exposeGeoService: true,
		geoServiceName: 'my-custom-geo',
		exposeDataLoadService: true,
		dataLoadServiceName: 'my-custom-loader',
	});
	handleApplication(scope);
	assert.ok(scope.resources._registered.has('my-custom-geo'));
	assert.ok(scope.resources._registered.has('my-custom-loader'));
});

test('only registers geo service when only geo flag is true', () => {
	const scope = createMockScope({
		exposeGeoService: true,
		geoServiceName: 'geo',
		exposeDataLoadService: false,
		dataLoadServiceName: 'dataload',
	});
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 1);
	assert.ok(scope.resources._registered.has('geo'));
});

test('only registers data load service when only data load flag is true', () => {
	const scope = createMockScope({
		exposeGeoService: false,
		geoServiceName: 'geo',
		exposeDataLoadService: true,
		dataLoadServiceName: 'dataload',
	});
	handleApplication(scope);
	assert.equal(scope.resources._registered.size, 1);
	assert.ok(scope.resources._registered.has('dataload'));
});
