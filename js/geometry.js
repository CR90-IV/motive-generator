// ========================================
// Geometry Utilities
// ========================================

/**
 * Orders ways so they connect properly without criss-crossing
 * @param {Array} ways - Array of way objects with geometry (lat/lon format)
 * @returns {Array} - Ordered array of ways
 */
function orderWays(ways) {
    if (ways.length <= 1) return ways;

    const ordered = [ways[0]];
    const remaining = ways.slice(1);

    while (remaining.length > 0) {
        const lastWay = ordered[ordered.length - 1];
        const lastPoint = lastWay[lastWay.length - 1];

        // Find a way that connects to the end of the last way
        let foundIndex = -1;
        let shouldReverse = false;

        for (let i = 0; i < remaining.length; i++) {
            const way = remaining[i];
            const firstPoint = way[0];
            const lastWayPoint = way[way.length - 1];

            // Check if this way's start connects to our last point
            if (pointsClose(lastPoint, firstPoint)) {
                foundIndex = i;
                shouldReverse = false;
                break;
            }

            // Check if this way's end connects to our last point (needs reversing)
            if (pointsClose(lastPoint, lastWayPoint)) {
                foundIndex = i;
                shouldReverse = true;
                break;
            }
        }

        if (foundIndex >= 0) {
            const nextWay = remaining.splice(foundIndex, 1)[0];
            if (shouldReverse) {
                nextWay.reverse();
            }
            ordered.push(nextWay);
        } else {
            // No connection found - just append the next way
            console.warn(`[Geometry Order] No connection found, appending way anyway`);
            ordered.push(remaining.shift());
        }
    }

    return ordered;
}

/**
 * Checks if two lat/lon points are approximately equal (within 0.0001 degrees)
 */
function pointsClose(p1, p2) {
    const tolerance = 0.0001;
    return Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance;
}

/**
 * Extracts geometry and center point from an OSM element
 * @param {Object} element - OSM element (node/way/relation)
 * @returns {{lat: number, lon: number, geometry: Array|null}}
 */
function extractGeometry(element) {
    let geometry = null;
    let lat, lon;

    if (element.type === 'relation' && element.members) {
        // Relation - extract geometry from outer members with proper ordering
        const outerMembers = element.members.filter(m => m.role === 'outer' && m.geometry);
        if (outerMembers.length > 0) {
            // Convert each member's geometry to lat/lon array
            const ways = outerMembers.map(member =>
                member.geometry.map(node => [node.lat, node.lon])
            );

            // Order the ways to connect properly
            const orderedWays = orderWays(ways);

            // Concatenate ordered ways
            const allPoints = [];
            orderedWays.forEach(way => {
                allPoints.push(...way);
            });

            if (allPoints.length > 0) {
                geometry = allPoints;
                const lats = geometry.map(p => p[0]);
                const lons = geometry.map(p => p[1]);
                lat = lats.reduce((a, b) => a + b) / lats.length;
                lon = lons.reduce((a, b) => a + b) / lons.length;
            }
        }

        // Fallback: use center if provided and no geometry found
        if (!lat && element.center) {
            lat = element.center.lat;
            lon = element.center.lon;
        }
    } else if (element.type === 'way' && element.geometry) {
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
    }

    // No valid coordinates
    if (lat === undefined || lon === undefined) {
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
