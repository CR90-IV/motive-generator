// ========================================
// Geometry Utilities
// ========================================

/**
 * Extracts geometry and center point from an OSM element
 * @param {Object} element - OSM element (node/way/relation)
 * @returns {{lat: number, lon: number, geometry: Array|null}}
 */
function extractGeometry(element) {
    let geometry = null;
    let lat, lon;

    if (element.type === 'way' && element.geometry) {
        // Way - has geometry points
        geometry = element.geometry.map(node => [node.lat, node.lon]);

        // Calculate center from geometry
        const lats = geometry.map(p => p[0]);
        const lons = geometry.map(p => p[1]);
        lat = lats.reduce((a, b) => a + b) / lats.length;
        lon = lons.reduce((a, b) => a + b) / lons.length;
    } else if (element.lat !== undefined && element.lon !== undefined) {
        // Node - has direct lat/lon
        lat = element.lat;
        lon = element.lon;
    } else {
        // No valid coordinates
        return null;
    }

    return { lat, lon, geometry };
}

/**
 * Gets corners of a grid square
 */
function getSquareCorners(easting, northing, squareSize) {
    return {
        sw: osGridToLatLon(easting, northing),
        ne: osGridToLatLon(easting + squareSize, northing + squareSize),
        nw: osGridToLatLon(easting, northing + squareSize),
        se: osGridToLatLon(easting + squareSize, northing)
    };
}

/**
 * Processes an OSM element into a standard format
 */
function processElement(element, squareCorners) {
    const coords = extractGeometry(element);
    if (!coords) return null;

    const { lat, lon, geometry } = coords;
    const { sw, ne, nw, se } = squareCorners;

    const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);
    const insideSquare = distance === 0;

    return {
        lat,
        lon,
        geometry,
        distance,
        inside: insideSquare,
        osmType: element.type,
        osmId: element.id,
        tags: element.tags || {}
    };
}
