# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web application that randomly selects Ordnance Survey National Grid 1km squares within Greater London and displays them on an interactive map. Designed to run on mobile devices via GitHub Pages.

## Development

No build process required. Simply open `index.html` in a web browser to test locally.

## Architecture

### Files
- `index.html` - Main HTML structure and UI
- `styles.css` - Responsive styling for mobile and desktop
- `app.js` - Core application logic

### Key Components

**OS Grid System (`app.js`)**
- `osGridToLatLon(easting, northing)` - Converts OS Grid coordinates to WGS84 lat/lon using Transverse Mercator projection
- `formatGridRef(easting, northing)` - Formats coordinates as standard OS grid reference (e.g., "TQ 30000 80000")
- Uses OSGB36 datum with proper conversion parameters

**London Boundaries**
- Defined in `LONDON_BOUNDS` constant in `app.js`
- Covers TQ grid square: eastings 503000-561000, northings 155000-200000
- Generates random 1km squares aligned to OS grid

**Mapping**
- Uses Leaflet.js (loaded via CDN)
- Displays selected square as blue polygon overlay
- Auto-zooms to fit square with padding

## Deployment

Configured for GitHub Pages (no configuration files needed). All resources are served from root directory.