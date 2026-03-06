# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Geolookup is a Harper application that performs reverse geocoding. Given lat/lon coordinates, it finds the best matching location (place, county subdivision, or county) using H3 spatial indexing. It uses the `h3-js` library to convert coordinates to H3 cell indexes and traverses resolution levels to find matches.

## Commands

- `npm run dev` -start Harper dev server (serves on http://localhost:9926)
- `npm run start` -start Harper production server
- `npm test` -run tests (uses Node.js built-in test runner)
- `npm run test:watch` -run tests in watch mode
- `node --test test/counter.test.js` -run a single test file
- `npm run lint` -ESLint
- `npm run format` -Prettier
- `npm run deploy` -deploy to Harper Fabric (requires `.env` credentials)

## Architecture

**Harper Component App** -configured via `config.yaml`, which points to `src/index.ts` as the plugin module.

- `src/index.ts` -Plugin entry point. Exports `Geolookup` and `DataLoad` resources. Implements `handleApplication()` which conditionally registers services based on scope options (`exposeGeoService`/`geoServiceName`, `exposeDataLoadService`/`dataLoadServiceName`).
- `src/types.ts` -Defines the `GeolookupConfig` interface for plugin configuration options.
- `resources/Geolookup.ts` -Core logic. Extends Harper `Resource`. The `get()` handler accepts `lat`/`lon` query params, converts to H3 index at resolution 9, then searches `Cell` table with progressively coarser resolutions (9→2) to find the best location match. Priority: place > county_subdivision > county.
- `resources/DataLoad.ts` -Bulk data loading endpoint. Accepts a `state` query param, validates the tar file exists, creates a `DataLoadJob` record, and returns the job ID immediately. Extraction and loading run asynchronously, updating job progress through status transitions (`pending` → `extracting` → `loading_locations` → `loading_cells` → `completed`/`error`).
- `schemas/schema.graphql` -Defines three tables in the `geolookup` database:
  - `Location` -geographic entities (places, counties, subdivisions) with tier-based hierarchy
  - `Cell` -H3 cells linking to locations at 3 tiers via `@relationship` directives
  - `DataLoadJob` -tracks async data load job progress, exported for direct querying
- `data/` -Pre-packaged `.tar.gz` files per state/territory containing Location and Cell JSON data
- `web/` -Static frontend served by Harper's static component
- `config.yaml` -Harper app config; `graphqlSchema` loads schemas, `pluginModule` points to `src/index.ts`

## Workflow

- Always present a plan and get approval before making code changes.

## Key Details

- Node.js 24.13.1 (see `.nvmrc`)
- TypeScript runs via Node.js type stripping (no build step)
- Tests use `node:test` and `node:assert/strict` (not Jest/Vitest)
- ESLint flat config (`eslint.config.js`)
- `.env` contains deployment credentials -never commit
