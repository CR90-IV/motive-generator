// ========================================
// Ordnance Survey Grid Conversion
// ========================================

/**
 * Converts OS Grid coordinates (OSGB36) to WGS84 lat/lon
 * @param {number} easting - Easting coordinate in meters
 * @param {number} northing - Northing coordinate in meters
 * @returns {{lat: number, lon: number}} Latitude and longitude in degrees
 */
function osGridToLatLon(easting, northing) {
    // OSGB36 ellipsoid parameters (Airy 1830)
    const a = 6377563.396;
    const b = 6356256.909;
    const F0 = 0.9996012717;
    const lat0 = 49 * Math.PI / 180;
    const lon0 = -2 * Math.PI / 180;
    const N0 = -100000;
    const E0 = 400000;
    const e2 = 1 - (b * b) / (a * a);
    const n = (a - b) / (a + b);

    let lat = lat0;
    let M = 0;

    do {
        lat = ((northing - N0 - M) / (a * F0)) + lat;
        const Ma = (1 + n + (5/4)*n*n + (5/4)*n*n*n) * (lat - lat0);
        const Mb = (3*n + 3*n*n + (21/8)*n*n*n) * Math.sin(lat-lat0) * Math.cos(lat+lat0);
        const Mc = ((15/8)*n*n + (15/8)*n*n*n) * Math.sin(2*(lat-lat0)) * Math.cos(2*(lat+lat0));
        const Md = (35/24)*n*n*n * Math.sin(3*(lat-lat0)) * Math.cos(3*(lat+lat0));
        M = b * F0 * (Ma - Mb + Mc - Md);
    } while (northing - N0 - M >= 0.001);

    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
    const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
    const eta2 = nu / rho - 1;

    const tanLat = Math.tan(lat);
    const tan2lat = tanLat * tanLat;
    const tan4lat = tan2lat * tan2lat;
    const tan6lat = tan4lat * tan2lat;
    const secLat = 1 / cosLat;
    const nu3 = nu * nu * nu;
    const nu5 = nu3 * nu * nu;
    const nu7 = nu5 * nu * nu;
    const VII = tanLat / (2 * rho * nu);
    const VIII = tanLat / (24 * rho * nu3) * (5 + 3 * tan2lat + eta2 - 9 * tan2lat * eta2);
    const IX = tanLat / (720 * rho * nu5) * (61 + 90 * tan2lat + 45 * tan4lat);
    const X = secLat / nu;
    const XI = secLat / (6 * nu3) * (nu / rho + 2 * tan2lat);
    const XII = secLat / (120 * nu5) * (5 + 28 * tan2lat + 24 * tan4lat);
    const XIIA = secLat / (5040 * nu7) * (61 + 662 * tan2lat + 1320 * tan4lat + 720 * tan6lat);

    const dE = easting - E0;
    const dE2 = dE * dE;
    const dE3 = dE2 * dE;
    const dE4 = dE2 * dE2;
    const dE5 = dE3 * dE2;
    const dE6 = dE4 * dE2;
    const dE7 = dE5 * dE2;

    lat = lat - VII * dE2 + VIII * dE4 - IX * dE6;
    const lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7;

    const latLonWGS84 = osgb36ToWGS84(lat, lon, a, b);

    return {
        lat: latLonWGS84.lat * 180 / Math.PI,
        lon: latLonWGS84.lon * 180 / Math.PI
    };
}

/**
 * Converts WGS84 lat/lon to OSGB36 easting/northing
 * @param {number} lat - Latitude in degrees (WGS84)
 * @param {number} lon - Longitude in degrees (WGS84)
 * @returns {{easting: number, northing: number}}
 */
function latLonToOSGrid(lat, lon) {
    // Convert to radians
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;

    // First convert WGS84 to OSGB36
    const osgb = wgs84ToOSGB36(latRad, lonRad);

    // Then convert OSGB36 to easting/northing using Transverse Mercator
    const a = 6377563.396;
    const b = 6356256.909;
    const F0 = 0.9996012717;
    const lat0 = 49 * Math.PI / 180;
    const lon0 = -2 * Math.PI / 180;
    const N0 = -100000;
    const E0 = 400000;
    const e2 = 1 - (b * b) / (a * a);
    const n = (a - b) / (a + b);

    const lat_osgb = osgb.lat;
    const lon_osgb = osgb.lon;

    const cosLat = Math.cos(lat_osgb);
    const sinLat = Math.sin(lat_osgb);
    const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
    const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
    const eta2 = nu / rho - 1;

    const Ma = (1 + n + (5/4)*n*n + (5/4)*n*n*n) * (lat_osgb - lat0);
    const Mb = (3*n + 3*n*n + (21/8)*n*n*n) * Math.sin(lat_osgb - lat0) * Math.cos(lat_osgb + lat0);
    const Mc = ((15/8)*n*n + (15/8)*n*n*n) * Math.sin(2*(lat_osgb - lat0)) * Math.cos(2*(lat_osgb + lat0));
    const Md = (35/24)*n*n*n * Math.sin(3*(lat_osgb - lat0)) * Math.cos(3*(lat_osgb + lat0));
    const M = b * F0 * (Ma - Mb + Mc - Md);

    const tanLat = Math.tan(lat_osgb);
    const tan2lat = tanLat * tanLat;
    const tan4lat = tan2lat * tan2lat;
    const tan6lat = tan4lat * tan2lat;
    const secLat = 1 / cosLat;
    const nu3 = nu * nu * nu;
    const nu5 = nu3 * nu * nu;
    const nu7 = nu5 * nu * nu;

    const I = M + N0;
    const II = (nu / 2) * sinLat * cosLat;
    const III = (nu / 24) * sinLat * Math.pow(cosLat, 3) * (5 - tan2lat + 9 * eta2);
    const IIIA = (nu / 720) * sinLat * Math.pow(cosLat, 5) * (61 - 58 * tan2lat + tan4lat);
    const IV = nu * cosLat;
    const V = (nu / 6) * Math.pow(cosLat, 3) * (nu / rho - tan2lat);
    const VI = (nu / 120) * Math.pow(cosLat, 5) * (5 - 18 * tan2lat + tan4lat + 14 * eta2 - 58 * tan2lat * eta2);

    const dLon = lon_osgb - lon0;
    const dLon2 = dLon * dLon;
    const dLon3 = dLon2 * dLon;
    const dLon4 = dLon2 * dLon2;
    const dLon5 = dLon3 * dLon2;
    const dLon6 = dLon4 * dLon2;

    const northing = I + II * dLon2 + III * dLon4 + IIIA * dLon6;
    const easting = E0 + IV * dLon + V * dLon3 + VI * dLon5;

    return { easting: Math.round(easting), northing: Math.round(northing) };
}

/**
 * Converts WGS84 to OSGB36 using inverse Helmert transformation
 */
function wgs84ToOSGB36(latWGS, lonWGS) {
    const aWGS = 6378137.000;
    const bWGS = 6356752.3142;
    const aOSGB = 6377563.396;
    const bOSGB = 6356256.909;

    // Helmert transformation parameters (inverse)
    const tx = -446.448;
    const ty = 125.157;
    const tz = -542.060;
    const s = 20.4894;
    const rx = -0.1502;
    const ry = -0.2470;
    const rz = -0.8421;

    const e2WGS = 1 - (bWGS * bWGS) / (aWGS * aWGS);
    const sinLat = Math.sin(latWGS);
    const cosLat = Math.cos(latWGS);
    const sinLon = Math.sin(lonWGS);
    const cosLon = Math.cos(lonWGS);
    const nuWGS = aWGS / Math.sqrt(1 - e2WGS * sinLat * sinLat);

    const x1 = nuWGS * cosLat * cosLon;
    const y1 = nuWGS * cosLat * sinLon;
    const z1 = nuWGS * (1 - e2WGS) * sinLat;

    const sc = s * 1e-6 + 1;
    const rxRad = rx * Math.PI / 648000;
    const ryRad = ry * Math.PI / 648000;
    const rzRad = rz * Math.PI / 648000;

    const x2 = tx + sc * x1 - rzRad * y1 + ryRad * z1;
    const y2 = ty + rzRad * x1 + sc * y1 - rxRad * z1;
    const z2 = tz - ryRad * x1 + rxRad * y1 + sc * z1;

    const e2OSGB = 1 - (bOSGB * bOSGB) / (aOSGB * aOSGB);
    const p = Math.sqrt(x2 * x2 + y2 * y2);
    let latOSGB = Math.atan2(z2, p * (1 - e2OSGB));

    for (let i = 0; i < 10; i++) {
        const sinLatOSGB = Math.sin(latOSGB);
        const nuOSGB = aOSGB / Math.sqrt(1 - e2OSGB * sinLatOSGB * sinLatOSGB);
        latOSGB = Math.atan2(z2 + e2OSGB * nuOSGB * sinLatOSGB, p);
    }

    const lonOSGB = Math.atan2(y2, x2);

    return { lat: latOSGB, lon: lonOSGB };
}

/**
 * Converts OSGB36 coordinates to WGS84 using Helmert transformation
 */
function osgb36ToWGS84(latOSGB, lonOSGB, aOSGB, bOSGB) {
    const aWGS = 6378137.000;
    const bWGS = 6356752.3142;

    const tx = 446.448;
    const ty = -125.157;
    const tz = 542.060;
    const s = -20.4894;
    const rx = 0.1502;
    const ry = 0.2470;
    const rz = 0.8421;

    const sinLat = Math.sin(latOSGB);
    const cosLat = Math.cos(latOSGB);
    const sinLon = Math.sin(lonOSGB);
    const cosLon = Math.cos(lonOSGB);
    const e2OSGB = 1 - (bOSGB * bOSGB) / (aOSGB * aOSGB);
    const nu = aOSGB / Math.sqrt(1 - e2OSGB * sinLat * sinLat);

    const x1 = nu * cosLat * cosLon;
    const y1 = nu * cosLat * sinLon;
    const z1 = nu * (1 - e2OSGB) * sinLat;

    const sc = s * 1e-6 + 1;
    const rxRad = rx * Math.PI / 648000;
    const ryRad = ry * Math.PI / 648000;
    const rzRad = rz * Math.PI / 648000;

    const x2 = tx + sc * x1 - rzRad * y1 + ryRad * z1;
    const y2 = ty + rzRad * x1 + sc * y1 - rxRad * z1;
    const z2 = tz - ryRad * x1 + rxRad * y1 + sc * z1;

    const e2WGS = 1 - (bWGS * bWGS) / (aWGS * aWGS);
    const p = Math.sqrt(x2 * x2 + y2 * y2);
    let latWGS = Math.atan2(z2, p * (1 - e2WGS));

    for (let i = 0; i < 10; i++) {
        const sinLatWGS = Math.sin(latWGS);
        const nuWGS = aWGS / Math.sqrt(1 - e2WGS * sinLatWGS * sinLatWGS);
        latWGS = Math.atan2(z2 + e2WGS * nuWGS * sinLatWGS, p);
    }

    const lonWGS = Math.atan2(y2, x2);

    return { lat: latWGS, lon: lonWGS };
}

/**
 * Formats easting/northing as standard OS grid reference (e.g., "TQ3080")
 * @param {number} easting - Easting coordinate in meters
 * @param {number} northing - Northing coordinate in meters
 * @returns {string} Grid reference
 */
function formatGridRef(easting, northing) {
    const e100km = Math.floor(easting / 100000);
    const n100km = Math.floor(northing / 100000);

    let l1 = (19 - n100km) - (19 - n100km) % 5 + Math.floor((e100km + 10) / 5);
    let l2 = (19 - n100km) * 5 % 25 + e100km % 5;

    if (l1 > 7) l1++;
    if (l2 > 7) l2++;

    const letterPair = String.fromCharCode(l1 + 'A'.charCodeAt(0), l2 + 'A'.charCodeAt(0));

    const e = Math.floor((easting % 100000) / 1000);
    const n = Math.floor((northing % 100000) / 1000);

    const eStr = e.toString().padStart(2, '0');
    const nStr = n.toString().padStart(2, '0');

    return `${letterPair}${eStr}${nStr}`;
}

/**
 * Returns 10km grid reference from 1km grid reference
 */
function get10kmGridRef(gridRef) {
    if (gridRef.length >= 4) {
        return gridRef.substring(0, 2) + gridRef.charAt(2) + gridRef.charAt(4);
    }
    return gridRef;
}

/**
 * Parses a grid reference string into easting/northing coordinates
 * @param {string} gridRef - Grid reference (e.g., "TQ3080")
 * @returns {{easting: number, northing: number, precision: number}|null}
 */
function parseGridRef(gridRef) {
    // Remove spaces and convert to uppercase
    gridRef = gridRef.replace(/\s/g, '').toUpperCase();

    // Validate format (2 letters + even number of digits)
    if (!/^[A-Z]{2}\d+$/.test(gridRef)) {
        return null;
    }

    const letters = gridRef.substring(0, 2);
    const numbers = gridRef.substring(2);

    // Must have even number of digits
    if (numbers.length % 2 !== 0) {
        return null;
    }

    // Get the 100km square indices
    const l1 = letters.charCodeAt(0) - 'A'.charCodeAt(0);
    const l2 = letters.charCodeAt(1) - 'A'.charCodeAt(0);

    // Compensate for skipped 'I'
    const l1Adjusted = l1 > 7 ? l1 - 1 : l1;
    const l2Adjusted = l2 > 7 ? l2 - 1 : l2;

    // Calculate 100km square origin
    const e100km = ((l1Adjusted - 2) % 5) * 5 + (l2Adjusted % 5);
    const n100km = (19 - Math.floor(l1Adjusted / 5) * 5) - Math.floor(l2Adjusted / 5);

    // Parse the numeric part
    const halfLength = numbers.length / 2;
    const eStr = numbers.substring(0, halfLength);
    const nStr = numbers.substring(halfLength);

    // Calculate multiplier based on precision
    const multiplier = Math.pow(10, 5 - halfLength);

    const e = parseInt(eStr) * multiplier;
    const n = parseInt(nStr) * multiplier;

    const easting = e100km * 100000 + e;
    const northing = n100km * 100000 + n;

    // Validate it's within bounds
    if (easting < 0 || easting > 700000 || northing < 0 || northing > 1300000) {
        return null;
    }

    // Return with the precision (1km = 1000m)
    const precision = multiplier;
    return { easting, northing, precision };
}

/**
 * London boundaries (bounding box - kept for reference)
 */
const LONDON_BOUNDS = {
    minEasting: 503000,
    maxEasting: 561000,
    minNorthing: 155000,
    maxNorthing: 200000
};

/**
 * Central London boundaries (roughly zones 1-2)
 */
const CENTRAL_LONDON_BOUNDS = {
    minEasting: 525000,
    maxEasting: 535000,
    minNorthing: 175000,
    maxNorthing: 185000
};

/**
 * Greater London boundary polygon (OS Grid coordinates - easting, northing)
 * Simplified boundary with ~40 points covering Greater London administrative area
 */
const GREATER_LONDON_POLYGON = [
    [505000, 200000], [510000, 199000], [515000, 198000], [520000, 197000],
    [525000, 196000], [530000, 196000], [535000, 196000], [540000, 196000],
    [545000, 195000], [550000, 194000], [555000, 192000], [558000, 189000],
    [560000, 185000], [561000, 180000], [560000, 175000], [558000, 170000],
    [555000, 166000], [552000, 163000], [548000, 160000], [544000, 158000],
    [540000, 157000], [535000, 156000], [530000, 156000], [525000, 155000],
    [520000, 155000], [515000, 156000], [510000, 157000], [507000, 160000],
    [505000, 164000], [504000, 168000], [503000, 172000], [503000, 176000],
    [503000, 180000], [503000, 184000], [504000, 188000], [504000, 192000],
    [505000, 196000], [505000, 200000]
];

/**
 * Central London boundary polygon (more accurate than bbox)
 */
const CENTRAL_LONDON_POLYGON = [
    [525000, 185000], [528000, 184500], [531000, 184000], [533000, 183000],
    [535000, 181000], [535000, 179000], [535000, 177000], [534000, 175000],
    [532000, 175000], [530000, 175000], [528000, 175000], [526000, 176000],
    [525000, 177000], [525000, 179000], [525000, 181000], [525000, 183000],
    [525000, 185000]
];

/**
 * City of London boundary polygon (Square Mile)
 */
const CITY_OF_LONDON_POLYGON = [
    [532000, 181500], [533000, 181500], [533500, 181000], [533500, 180500],
    [533500, 180000], [533000, 180000], [532500, 180000], [532000, 180500],
    [532000, 181000], [532000, 181500]
];

/**
 * United Kingdom bounding box (using OS Grid extent)
 * Note: Using bbox for UK-wide as polygon would be too large
 */
const UK_BOUNDS = {
    minEasting: 0,
    maxEasting: 700000,
    minNorthing: 0,
    maxNorthing: 1300000
};

/**
 * Available geographic regions for selection
 */
const AREA_REGIONS = {
    'zone-1-2': {
        name: 'Central London (Zones 1-2)',
        boundary: CENTRAL_LONDON_POLYGON, // Fallback until loaded
        type: 'polygon',
        loading: false,
        dynamicBoundary: true // Mark as dynamically generated
    },
    'central-london': {
        name: 'Central London (Congestion Zone)',
        osmRelationId: 3045928,
        boundary: CENTRAL_LONDON_POLYGON, // Fallback
        type: 'polygon',
        loading: false
    },
    'greater-london': {
        name: 'Greater London',
        osmRelationId: 175342,
        boundary: GREATER_LONDON_POLYGON, // Fallback
        type: 'polygon',
        loading: false
    },
    'united-kingdom': {
        name: 'United Kingdom',
        osmRelationId: 62149,
        boundary: UK_BOUNDS, // Fallback
        type: 'bbox',
        loading: false
    }
};

/**
 * Computes convex hull from array of points using Graham scan
 * @param {Array} points - Array of [easting, northing] coordinates
 * @returns {Array} - Convex hull as array of points
 */
function convexHull(points) {
    if (points.length < 3) return points;

    // Sort points by x, then y
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // Build lower hull
    const lower = [];
    for (let i = 0; i < sorted.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
            lower.pop();
        }
        lower.push(sorted[i]);
    }

    // Build upper hull
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
            upper.pop();
        }
        upper.push(sorted[i]);
    }

    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();

    const hull = lower.concat(upper);

    // Ensure the hull is closed by adding the first point at the end if needed
    if (hull.length > 0 && (hull[0][0] !== hull[hull.length - 1][0] || hull[0][1] !== hull[hull.length - 1][1])) {
        hull.push(hull[0]);
    }

    return hull;
}

/**
 * Cross product helper for convex hull
 */
function cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Buffers a polygon by adding distance around it
 * @param {Array} polygon - Array of [easting, northing] coordinates
 * @param {number} bufferMeters - Buffer distance in meters
 * @returns {Array} - Buffered polygon
 */
function bufferPolygon(polygon, bufferMeters) {
    // Simple buffer: for each point, calculate normal and offset
    const buffered = [];

    for (let i = 0; i < polygon.length; i++) {
        const curr = polygon[i];
        const prev = polygon[(i - 1 + polygon.length) % polygon.length];
        const next = polygon[(i + 1) % polygon.length];

        // Calculate vectors
        const v1 = [curr[0] - prev[0], curr[1] - prev[1]];
        const v2 = [next[0] - curr[0], next[1] - curr[1]];

        // Normalize
        const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
        const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

        if (len1 > 0) {
            v1[0] /= len1;
            v1[1] /= len1;
        }
        if (len2 > 0) {
            v2[0] /= len2;
            v2[1] /= len2;
        }

        // Average normal (perpendicular)
        const normal = [-(v1[1] + v2[1]) / 2, (v1[0] + v2[0]) / 2];
        const normalLen = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1]);

        if (normalLen > 0) {
            normal[0] /= normalLen;
            normal[1] /= normalLen;
        }

        // Offset point
        buffered.push([
            Math.round(curr[0] + normal[0] * bufferMeters),
            Math.round(curr[1] + normal[1] * bufferMeters)
        ]);
    }

    // Close the polygon by adding the first point at the end
    if (buffered.length > 0) {
        buffered.push(buffered[0]);
    }

    return buffered;
}

/**
 * Generates Zone 1-2 boundary from station locations
 */
async function generateZone12Boundary() {
    console.log('[Zone 1-2] Generating boundary from station data...');

    try {
        // Query all London stations in zones 1-2 using bounding box
        // Greater London bbox approximately: 51.28-51.69N, 0.49W-0.34E
        const query = `
            [out:json][timeout:30];
            (
                node["railway"="station"]["fare_zone"~"^[12]$"](51.28,-0.49,51.69,0.34);
            );
            out body;
        `;

        console.log('[Zone 1-2] Fetching stations...');
        const instance = getCurrentOverpassInstance();
        console.log(`[Zone 1-2] Using ${instance.name} server`);
        const response = await fetch(instance.url, {
            method: 'POST',
            body: query
        });

        const data = await response.json();
        console.log(`[Zone 1-2] Found ${data.elements?.length || 0} stations`);

        if (!data.elements || data.elements.length < 3) {
            console.warn('[Zone 1-2] Not enough stations found, using fallback');
            return CENTRAL_LONDON_POLYGON;
        }

        // Convert stations to OS Grid coordinates
        const points = data.elements
            .filter(station => station.lat && station.lon)
            .map(station => {
                const coords = latLonToOSGrid(station.lat, station.lon);
                return [coords.easting, coords.northing];
            });

        console.log(`[Zone 1-2] Converted ${points.length} stations to OS Grid`);

        // Compute convex hull
        const hull = convexHull(points);
        console.log(`[Zone 1-2] Computed convex hull with ${hull.length} points`);

        // Buffer by 500m
        const buffered = bufferPolygon(hull, 500);
        console.log(`[Zone 1-2] Buffered boundary to ${buffered.length} points`);

        return buffered;
    } catch (error) {
        console.error('[Zone 1-2] Error generating boundary:', error);
        return CENTRAL_LONDON_POLYGON; // Fallback
    }
}

/**
 * Loads OSM boundaries for all preset regions
 * This runs asynchronously in the background
 */
async function loadPresetBoundaries() {
    for (const areaId in AREA_REGIONS) {
        const region = AREA_REGIONS[areaId];

        if (!region.loading && (region.osmRelationId || region.osmRelationIds || region.dynamicBoundary)) {
            region.loading = true;

            try {
                let boundary;

                if (region.dynamicBoundary && areaId === 'zone-1-2') {
                    // Dynamically generate Zone 1-2 boundary from station data
                    console.log(`[Boundaries] Generating ${region.name}...`);
                    boundary = await generateZone12Boundary();
                    console.log(`[Boundaries] Generated ${region.name}: ${boundary.length} points`);
                } else if (region.osmRelationIds) {
                    // Multiple relations to merge
                    console.log(`[Boundaries] Loading ${region.name} from ${region.osmRelationIds.length} relations...`);
                    const boundaries = [];

                    for (const relationId of region.osmRelationIds) {
                        console.log(`[Boundaries] Fetching relation ${relationId}...`);
                        const singleBoundary = await fetchOSMBoundary(relationId);
                        boundaries.push(singleBoundary);
                        console.log(`[Boundaries] Fetched ${singleBoundary.length} points from relation ${relationId}`);
                    }

                    // Merge all boundaries by concatenating points
                    boundary = [];
                    boundaries.forEach(b => {
                        boundary = boundary.concat(b);
                    });

                    console.log(`[Boundaries] Merged ${boundaries.length} boundaries into ${boundary.length} total points`);
                } else {
                    // Single relation
                    console.log(`[Boundaries] Loading ${region.name}...`);
                    boundary = await fetchOSMBoundary(region.osmRelationId);
                    console.log(`[Boundaries] Loaded ${region.name}: ${boundary.length} points`);
                }

                // Update the region with the fetched boundary
                region.boundary = boundary;
                region.type = 'polygon';

                // Redraw boundary if this is the currently selected area
                if (typeof currentAreaId !== 'undefined' && currentAreaId === areaId && typeof drawAreaBoundary === 'function') {
                    console.log(`[Boundaries] Redrawing boundary for active area ${region.name}`);
                    drawAreaBoundary(boundary, 'polygon');
                }
            } catch (error) {
                console.warn(`[Boundaries] Failed to load ${region.name}, using fallback:`, error);
                // Keep the fallback boundary
            } finally {
                region.loading = false;
            }
        }
    }
}

// Start loading boundaries when this script loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        loadPresetBoundaries();
    });
}

/**
 * Tests if a point is inside a polygon using ray casting algorithm
 * @param {number} easting - Point easting coordinate
 * @param {number} northing - Point northing coordinate
 * @param {Array} polygon - Array of [easting, northing] coordinate pairs
 * @returns {boolean} True if point is inside polygon
 */
function isPointInPolygon(easting, northing, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > northing) !== (yj > northing)) &&
            (easting < (xj - xi) * (northing - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Generates random 1km square within specified polygon boundary
 * @param {Array|Object} boundary - Either a polygon array or bounds object for backwards compatibility
 * @returns {{easting: number, northing: number}}
 */
function getRandomSquare(boundary = GREATER_LONDON_POLYGON) {
    console.log(`[Random Square] Called with boundary:`, boundary);
    console.log(`[Random Square] Boundary type:`, Array.isArray(boundary) ? 'polygon' : 'bbox');

    // Handle backwards compatibility with bbox bounds
    if (boundary.minEasting !== undefined) {
        console.log(`[Random Square] Using bbox mode`);
        const easting = Math.floor(Math.random() * (boundary.maxEasting - boundary.minEasting) / 1000) * 1000 + boundary.minEasting;
        const northing = Math.floor(Math.random() * (boundary.maxNorthing - boundary.minNorthing) / 1000) * 1000 + boundary.minNorthing;
        console.log(`[Random Square] Generated (bbox): E=${easting}, N=${northing}`);
        return { easting, northing };
    }

    // For polygon boundaries, calculate bounding box first for efficiency
    const minEasting = Math.min(...boundary.map(p => p[0]));
    const maxEasting = Math.max(...boundary.map(p => p[0]));
    const minNorthing = Math.min(...boundary.map(p => p[1]));
    const maxNorthing = Math.max(...boundary.map(p => p[1]));

    console.log(`[Random Square] Polygon bounds - E: ${minEasting} to ${maxEasting}, N: ${minNorthing} to ${maxNorthing}`);
    console.log(`[Random Square] Polygon has ${boundary.length} points`);

    // Keep trying random points until we find one inside the polygon
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
        const easting = Math.floor(Math.random() * (maxEasting - minEasting) / 1000) * 1000 + minEasting;
        const northing = Math.floor(Math.random() * (maxNorthing - minNorthing) / 1000) * 1000 + minNorthing;

        // Check if this 1km square's center is inside the polygon
        const centerEasting = easting + 500;
        const centerNorthing = northing + 500;

        const isInside = isPointInPolygon(centerEasting, centerNorthing, boundary);

        if (attempts < 3) {
            console.log(`[Random Square] Attempt ${attempts + 1}: E=${easting}, N=${northing}, center=(${centerEasting}, ${centerNorthing}), inside=${isInside}`);
        }

        if (isInside) {
            console.log(`[Random Square] Found valid point after ${attempts + 1} attempts: E=${easting}, N=${northing}`);
            return { easting, northing };
        }

        attempts++;
    }

    // Fallback: if we can't find a point after many attempts, return center of bbox
    console.warn('[Random Square] Could not find random point in polygon after', maxAttempts, 'attempts, using fallback');
    const fallbackEasting = Math.floor((minEasting + maxEasting) / 2000) * 1000;
    const fallbackNorthing = Math.floor((minNorthing + maxNorthing) / 2000) * 1000;
    console.log(`[Random Square] Fallback point: E=${fallbackEasting}, N=${fallbackNorthing}`);
    return { easting: fallbackEasting, northing: fallbackNorthing };
}

/**
 * Snaps easting/northing to nearest 1km grid square (southwest corner)
 * @param {number} easting - Easting coordinate
 * @param {number} northing - Northing coordinate
 * @returns {{easting: number, northing: number}}
 */
function snapToGrid(easting, northing) {
    return {
        easting: Math.floor(easting / 1000) * 1000,
        northing: Math.floor(northing / 1000) * 1000
    };
}
