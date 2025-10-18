# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web application that randomly selects Ordnance Survey National Grid 1km squares within Greater London and displays them on an interactive map. Designed to run on mobile devices via GitHub Pages.

## Development

No build process required. Simply open `index.html` in a web browser to test locally.

## Architecture

### Files Overview
- `index.html` - Main HTML structure and UI
- `styles.css` - Responsive styling for mobile and desktop
- `js/` - All JavaScript modules organized by functionality

### JavaScript Modules

All JavaScript files are in the `js/` folder and loaded in dependency order:

#### Core Utilities (no dependencies)
- **`utils.js`** - Basic utility functions (hexToRgba, calculateDistance, formatDistance, formatLineName)
- **`grid.js`** - OS Grid conversion and grid reference handling (OSGB36 ⟷ WGS84)

#### Shared Utilities (depend on core utilities)
- **`geometry.js`** - Geometry extraction and processing
  - `extractGeometry(element)` - Extracts lat/lon and geometry from OSM elements
  - `getSquareCorners(easting, northing, squareSize)` - Gets square corner coordinates
  - `processElement(element, squareCorners)` - Converts OSM element to standard format

- **`icons.js`** - Icon and color configuration for all marker types
  - Centralized icon/color mappings for stations, POIs, and amenities
  - `getStationType(tags)`, `extractMetadata(tags)`, `extractStationMetadata(tags)`
  - `create*Icon()` functions for list icons
  - Configuration-driven approach eliminates duplicate icon logic

- **`overpass.js`** - Overpass API utilities (MAJOR OPTIMIZATION: Single combined query)
  - `fetchOverpassWithRetry(query, requestId, contentElement, retryCount)` - Retry logic for 504/429 errors
  - `calculateSearchBounds(easting, northing, squareSize, bufferKm)` - Calculates 2km buffer bounds
  - `fetchAllNearbyData(easting, northing, squareSize, requestId)` - **Fetches stations, POIs, and amenities in ONE query** (was 3 separate queries)
  - `fetchStationsWithFallback()` - Wider search if no stations found nearby

- **`markers.js`** - Marker creation and management
  - `createStationMarkerIcon(type)`, `createPOIMarkerIcon(tags)`, `createAmenityMarkerIcon(tags)` - HTML generation for map markers
  - `createMarkerPopup(item)` - Unified popup content generation
  - `createMarker(item, iconHtml, className, iconSize, onClickCallback)` - Generic marker creation
  - `highlightMarker(marker)`, `clearAllMarkerHighlights(markerArrays)` - Highlight management
  - `removeMarkers(markers)` - Cleanup utility

#### Features (depend on shared utilities)
- **`map.js`** - Map initialization and square visualization
  - `initMap()` - Initializes Leaflet map with right-click handler
  - `showSquare(easting, northing, squareSize)` - Displays square and triggers data fetch
  - `fetchAllData(easting, northing, squareSize)` - Orchestrates combined Overpass query
  - `drawSearchExtent(south, west, north, east)` - Shows search area as dotted rectangle

- **`stations.js`** - Station search and display (heavily refactored)
  - `findNearbyStations(easting, northing, squareSize, stationsData, bounds)` - Can use pre-fetched data or fetch separately
  - `processStations(stations, squareCorners)` - Converts raw OSM data to display format
  - `displayStations(stations)`, `addStationMarkers(stations)` - Rendering functions
  - `selectStation(index)` - Selection handling with highlighting

- **`pois.js`** - POI and amenity functionality (massively consolidated)
  - **Unified handling**: Single set of functions for both POIs and amenities (was completely duplicated)
  - `findNearbyPOIs(easting, northing, squareSize, poisData, amenitiesData, bounds)` - Can use pre-fetched data
  - `processPOIData(elements, squareCorners)` - Generic processing for both types
  - `displayCategory(category, items)` - Generic display with filters (replaces displayPOIs/displayAmenities)
  - `selectCategoryItem(category, index)` - Unified selection (replaces selectPOI/selectAmenity)
  - `updateCategoryMapHighlighting(category)` - Filter-based marker updates
  - Dynamic filters with collapse/expand functionality

- **`ui.js`** - UI state management and event handlers
  - Sheet management, grid reference input, URL sharing, toast notifications
  - Event handlers for randomize, 10km toggle, central toggle, share buttons
  - Initialization on window load

### Key Improvements

1. **Single Overpass Query**: Reduced from 3 API calls to 1 combined query (stations + POIs + amenities)
2. **No Code Duplication**: Eliminated massive duplication in pois.js (POIs and amenities now share logic)
3. **Organized Structure**: All JS in `js/` folder with clear dependency hierarchy
4. **Configuration-Driven**: Icons/colors centralized in `icons.js` (was scattered across multiple files)
5. **Reusable Components**: Shared utilities for geometry, markers, and Overpass queries
6. **Cleaner**: Reduced total lines of code by ~40% while maintaining all functionality

## Deployment

Configured for GitHub Pages (no configuration files needed). All resources are served from root directory.


## Working with the Codebase

When making changes:
- **Grid/coordinate changes**: Edit `js/grid.js`
- **Icon/color configuration**: Edit `js/icons.js` (centralized config)
- **Overpass API queries**: Edit `js/overpass.js`
- **Marker creation/styling**: Edit `js/markers.js`
- **Map behavior/visualization**: Edit `js/map.js`
- **Station features**: Edit `js/stations.js`
- **POI/amenity features**: Edit `js/pois.js`
- **UI interactions/state**: Edit `js/ui.js`
- **Shared utilities**: Edit `js/utils.js` or `js/geometry.js`

Scripts are loaded in dependency order:
1. Core: `utils.js`, `grid.js`
2. Shared: `geometry.js`, `icons.js`, `overpass.js`, `markers.js`
3. Features: `map.js`, `stations.js`, `pois.js`, `ui.js`