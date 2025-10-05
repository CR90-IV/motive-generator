// Ordnance Survey National Grid Reference System
// Greater London roughly covers TQ grid square (some parts extend to TL and SU)

// OS Grid conversion functions
function osGridToLatLon(easting, northing) {
    // OSGB36 ellipsoid parameters (Airy 1830)
    const a = 6377563.396;  // semi-major axis
    const b = 6356256.909;  // semi-minor axis
    const F0 = 0.9996012717;  // scale factor on central meridian
    const lat0 = 49 * Math.PI / 180;  // latitude of true origin
    const lon0 = -2 * Math.PI / 180;  // longitude of true origin
    const N0 = -100000;  // northing of true origin
    const E0 = 400000;  // easting of true origin
    const e2 = 1 - (b * b) / (a * a);  // eccentricity squared
    const n = (a - b) / (a + b);

    let lat = lat0;
    let M = 0;

    // Iterate to find latitude (OSGB36)
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

    // Convert OSGB36 lat/lon to WGS84 using Helmert transformation
    const latLonWGS84 = osgb36ToWGS84(lat, lon, a, b);

    return {
        lat: latLonWGS84.lat * 180 / Math.PI,
        lon: latLonWGS84.lon * 180 / Math.PI
    };
}

// Helmert transformation from OSGB36 to WGS84
function osgb36ToWGS84(latOSGB, lonOSGB, aOSGB, bOSGB) {
    // WGS84 ellipsoid parameters
    const aWGS = 6378137.000;
    const bWGS = 6356752.3142;

    // Helmert transformation parameters (OSGB36 to WGS84)
    const tx = 446.448;    // metres
    const ty = -125.157;   // metres
    const tz = 542.060;    // metres
    const s = -20.4894;    // ppm
    const rx = 0.1502;     // arcseconds
    const ry = 0.2470;     // arcseconds
    const rz = 0.8421;     // arcseconds

    // Convert lat/lon to Cartesian coordinates (OSGB36)
    const sinLat = Math.sin(latOSGB);
    const cosLat = Math.cos(latOSGB);
    const sinLon = Math.sin(lonOSGB);
    const cosLon = Math.cos(lonOSGB);
    const e2OSGB = 1 - (bOSGB * bOSGB) / (aOSGB * aOSGB);
    const nu = aOSGB / Math.sqrt(1 - e2OSGB * sinLat * sinLat);

    const x1 = nu * cosLat * cosLon;
    const y1 = nu * cosLat * sinLon;
    const z1 = nu * (1 - e2OSGB) * sinLat;

    // Apply Helmert transformation
    const sc = s * 1e-6 + 1;  // scale factor
    const rxRad = rx * Math.PI / 648000;  // arcseconds to radians
    const ryRad = ry * Math.PI / 648000;
    const rzRad = rz * Math.PI / 648000;

    const x2 = tx + sc * x1 - rzRad * y1 + ryRad * z1;
    const y2 = ty + rzRad * x1 + sc * y1 - rxRad * z1;
    const z2 = tz - ryRad * x1 + rxRad * y1 + sc * z1;

    // Convert Cartesian back to lat/lon (WGS84)
    const e2WGS = 1 - (bWGS * bWGS) / (aWGS * aWGS);
    const p = Math.sqrt(x2 * x2 + y2 * y2);
    let latWGS = Math.atan2(z2, p * (1 - e2WGS));

    // Iterate to refine latitude
    for (let i = 0; i < 10; i++) {
        const sinLatWGS = Math.sin(latWGS);
        const nuWGS = aWGS / Math.sqrt(1 - e2WGS * sinLatWGS * sinLatWGS);
        latWGS = Math.atan2(z2 + e2WGS * nuWGS * sinLatWGS, p);
    }

    const lonWGS = Math.atan2(y2, x2);

    return { lat: latWGS, lon: lonWGS };
}

function formatGridRef(easting, northing) {
    // Get the 100km-grid indices
    const e100km = Math.floor(easting / 100000);
    const n100km = Math.floor(northing / 100000);

    // Translate those into numeric equivalents of the grid letters
    // Using the official OS algorithm with false origin at SV
    let l1 = (19 - n100km) - (19 - n100km) % 5 + Math.floor((e100km + 10) / 5);
    let l2 = (19 - n100km) * 5 % 25 + e100km % 5;

    // Compensate for skipped 'I'
    if (l1 > 7) l1++;
    if (l2 > 7) l2++;

    const letterPair = String.fromCharCode(l1 + 'A'.charCodeAt(0), l2 + 'A'.charCodeAt(0));

    // Get eastings and northings within the 100km square (in km for compact format)
    const e = Math.floor((easting % 100000) / 1000);
    const n = Math.floor((northing % 100000) / 1000);

    // Format as compact reference (e.g., TQ4289)
    const eStr = e.toString().padStart(2, '0');
    const nStr = n.toString().padStart(2, '0');

    return `${letterPair}${eStr}${nStr}`;
}

// Greater London boundaries (approximate, in OS Grid)
// TQ square covers most of London
const LONDON_BOUNDS = {
    minEasting: 503000,   // Western edge
    maxEasting: 561000,   // Eastern edge
    minNorthing: 155000,  // Southern edge
    maxNorthing: 200000   // Northern edge
};

function getRandomSquare() {
    // Generate random 1km square within Greater London
    const easting = Math.floor(Math.random() * (LONDON_BOUNDS.maxEasting - LONDON_BOUNDS.minEasting) / 1000) * 1000 + LONDON_BOUNDS.minEasting;
    const northing = Math.floor(Math.random() * (LONDON_BOUNDS.maxNorthing - LONDON_BOUNDS.minNorthing) / 1000) * 1000 + LONDON_BOUNDS.minNorthing;

    return { easting, northing };
}

// Map initialization
let map;
let currentMarker;

function initMap() {
    map = L.map('map').setView([51.5074, -0.1278], 10);  // Center on London

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function showSquareOnMap(easting, northing) {
    const center = osGridToLatLon(easting + 500, northing + 500);  // Center of 1km square
    const gridRef = formatGridRef(easting, northing);

    // Remove previous marker if exists
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Draw square on map
    const sw = osGridToLatLon(easting, northing);
    const ne = osGridToLatLon(easting + 1000, northing + 1000);
    const nw = osGridToLatLon(easting, northing + 1000);
    const se = osGridToLatLon(easting + 1000, northing);

    const square = L.polygon([
        [sw.lat, sw.lon],
        [se.lat, se.lon],
        [ne.lat, ne.lon],
        [nw.lat, nw.lon]
    ], {
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.3,
        weight: 2
    }).addTo(map);

    currentMarker = square;

    // Fit map to square
    map.fitBounds(square.getBounds(), { padding: [50, 50] });

    // Update info display
    document.getElementById('grid-ref').textContent = gridRef;
    document.getElementById('location').textContent = `${center.lat.toFixed(5)}°N, ${Math.abs(center.lon).toFixed(5)}°W`;
    document.getElementById('info').classList.remove('hidden');
}

// Event listeners
document.getElementById('randomize-btn').addEventListener('click', () => {
    const { easting, northing } = getRandomSquare();
    showSquareOnMap(easting, northing);
});

// Initialize map on load
window.addEventListener('load', initMap);
