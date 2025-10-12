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
 * London boundaries
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
 * Generates random 1km square within specified bounds
 * @param {Object} bounds - Bounds object with minEasting, maxEasting, minNorthing, maxNorthing
 * @returns {{easting: number, northing: number}}
 */
function getRandomSquare(bounds = LONDON_BOUNDS) {
    const easting = Math.floor(Math.random() * (bounds.maxEasting - bounds.minEasting) / 1000) * 1000 + bounds.minEasting;
    const northing = Math.floor(Math.random() * (bounds.maxNorthing - bounds.minNorthing) / 1000) * 1000 + bounds.minNorthing;
    return { easting, northing };
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
