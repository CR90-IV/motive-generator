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
let miniMap;
let currentMarker;
let miniMapMarker;
let currentEasting;
let currentNorthing;
let original1kmEasting;
let original1kmNorthing;
let currentViewMode = '1km'; // '1km' or '10km'

function initMap() {
    map = L.map('map').setView([51.5074, -0.1278], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Create inset minimap
    createMiniMap();
}

function createMiniMap() {
    // Create minimap container
    const MiniMapControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-control-minimap');
            container.style.width = '200px';
            container.style.height = '150px';
            container.style.backgroundColor = 'white';

            // Prevent map interactions from affecting main map
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            // Initialize minimap
            miniMap = L.map(container, {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false
            }).setView([51.5074, -0.1278], 10);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(miniMap);

            return container;
        }
    });

    map.addControl(new MiniMapControl());
}

function showSquareOnMap(easting, northing, squareSize = 1000) {
    currentEasting = easting;
    currentNorthing = northing;
    currentViewMode = squareSize === 1000 ? '1km' : '10km';

    // Store original 1km coordinates when first showing
    if (squareSize === 1000) {
        original1kmEasting = easting;
        original1kmNorthing = northing;
    }

    const center = osGridToLatLon(easting + squareSize / 2, northing + squareSize / 2);
    const gridRef = formatGridRef(easting, northing);

    // Remove previous marker if exists
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    if (miniMapMarker) {
        miniMap.removeLayer(miniMapMarker);
    }

    // Draw square on main map
    const sw = osGridToLatLon(easting, northing);
    const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
    const nw = osGridToLatLon(easting, northing + squareSize);
    const se = osGridToLatLon(easting + squareSize, northing);

    const square = L.polygon([
        [sw.lat, sw.lon],
        [se.lat, se.lon],
        [ne.lat, ne.lon],
        [nw.lat, nw.lon]
    ], {
        color: '#111827',
        fillColor: '#111827',
        fillOpacity: 0.2,
        weight: 2
    }).addTo(map);

    currentMarker = square;

    // Show marker on minimap
    const miniSquare = L.polygon([
        [sw.lat, sw.lon],
        [se.lat, se.lon],
        [ne.lat, ne.lon],
        [nw.lat, nw.lon]
    ], {
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.5,
        weight: 2
    }).addTo(miniMap);

    miniMapMarker = miniSquare;

    // Update info display
    const gridRefDisplay = squareSize === 1000 ? gridRef : get10kmGridRef(gridRef);
    const gridRefLabel = document.querySelector('.info-item label');
    gridRefLabel.textContent = squareSize === 1000 ? 'Grid Reference (1km)' : 'Grid Reference (10km)';
    document.getElementById('grid-ref').textContent = gridRefDisplay;
    document.getElementById('location').textContent = `${center.lat.toFixed(5)}°N, ${Math.abs(center.lon).toFixed(5)}°W`;
    document.getElementById('content-wrapper').classList.remove('hidden');

    // Fix map rendering after showing container
    setTimeout(() => {
        map.invalidateSize();
        if (miniMap) {
            miniMap.invalidateSize();
            // Fit minimap to London bounds
            const londonSW = osGridToLatLon(LONDON_BOUNDS.minEasting, LONDON_BOUNDS.minNorthing);
            const londonNE = osGridToLatLon(LONDON_BOUNDS.maxEasting, LONDON_BOUNDS.maxNorthing);
            miniMap.fitBounds([[londonSW.lat, londonSW.lon], [londonNE.lat, londonNE.lon]], { padding: [10, 10] });
        }
        // Re-fit main map bounds after invalidation
        if (currentMarker) {
            map.fitBounds(currentMarker.getBounds(), { padding: [50, 50] });
        }
    }, 200);

    // Update Google Maps link
    const googleMapsLink = `https://www.google.com/maps?q=${center.lat},${center.lon}`;
    document.getElementById('google-maps-link').href = googleMapsLink;

    // Update 10km button text
    const view10kmBtn = document.getElementById('view-10km-btn');
    if (squareSize === 1000) {
        view10kmBtn.innerHTML = '<span>📐</span> View 10km Square';
    } else {
        view10kmBtn.innerHTML = '<span>🔍</span> View 1km Square';
    }

    // Find nearby stations
    findNearbyStations(easting, northing, squareSize);
}

function get10kmGridRef(gridRef) {
    // Extract 10km square from grid ref (e.g., TQ5075 -> TQ57)
    if (gridRef.length >= 4) {
        return gridRef.substring(0, 2) + gridRef.charAt(2) + gridRef.charAt(4);
    }
    return gridRef;
}

// Fetch nearby stations using Overpass API
async function findNearbyStations(easting, northing, squareSize) {
    const stationsContent = document.getElementById('stations-content');

    // Show loading state
    stationsContent.innerHTML = '<p class="loading">Finding stations...</p>';

    try {
        // Convert grid square corners to lat/lon
        const sw = osGridToLatLon(easting, northing);
        const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
        const nw = osGridToLatLon(easting, northing + squareSize);
        const se = osGridToLatLon(easting + squareSize, northing);
        const center = osGridToLatLon(easting + squareSize / 2, northing + squareSize / 2);

        // Create bounding box with buffer (search slightly outside the square)
        let buffer = 0.02; // ~2km buffer
        const south = Math.min(sw.lat, ne.lat) - buffer;
        const north = Math.max(sw.lat, ne.lat) + buffer;
        const west = Math.min(sw.lon, ne.lon) - buffer;
        const east = Math.max(sw.lon, ne.lon) + buffer;

        // Overpass API query for railway stations only (not entrances)
        const query = `
            [out:json][timeout:25];
            (
                node["railway"="station"]["name"](${south},${west},${north},${east});
                node["railway"="halt"]["name"](${south},${west},${north},${east});
            );
            out body;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        const data = await response.json();

        // Calculate distances and sort
        const stations = data.elements.map(station => {
            // Calculate distance to edge of square
            const distance = distanceToSquareEdge(station.lat, station.lon, sw, ne, nw, se);

            // Determine if station is inside the square
            const insideSquare = distance === 0;

            // Get line or operator info
            const line = station.tags.line || station.tags['line:name'] || null;
            const operator = station.tags.operator || null;

            return {
                name: station.tags.name || 'Unnamed station',
                type: getStationType(station.tags),
                line: line,
                operator: operator,
                distance: distance,
                inside: insideSquare,
                lat: station.lat,
                lon: station.lon
            };
        }).filter(s => s.name !== 'Unnamed station')
          .sort((a, b) => {
              // Prioritize stations inside the square
              if (a.inside && !b.inside) return -1;
              if (!a.inside && b.inside) return 1;
              return a.distance - b.distance;
          });

        // If no stations found, expand search to find at least one
        if (stations.length === 0) {
            const widerQuery = `
                [out:json][timeout:25];
                (
                    node["railway"="station"]["name"](around:10000,${center.lat},${center.lon});
                    node["railway"="halt"]["name"](around:10000,${center.lat},${center.lon});
                );
                out body;
            `;

            const widerResponse = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: widerQuery
            });

            const widerData = await widerResponse.json();

            const allStations = widerData.elements.map(station => {
                const distance = distanceToSquareEdge(station.lat, station.lon, sw, ne, nw, se);
                const line = station.tags.line || station.tags['line:name'] || null;
                const operator = station.tags.operator || null;

                return {
                    name: station.tags.name || 'Unnamed station',
                    type: getStationType(station.tags),
                    line: line,
                    operator: operator,
                    distance: distance,
                    inside: false,
                    lat: station.lat,
                    lon: station.lon
                };
            }).filter(s => s.name !== 'Unnamed station')
              .sort((a, b) => a.distance - b.distance);

            // Take just the closest one
            stations.push(...allStations.slice(0, 1));
        }

        // Display stations
        if (stations.length === 0) {
            stationsContent.innerHTML = '<p class="no-stations">No stations found nearby</p>';
        } else {
            const insideStations = stations.filter(s => s.inside);
            const outsideStations = stations.filter(s => !s.inside).slice(0, 5);

            let html = '';

            if (insideStations.length > 0) {
                if (outsideStations.length > 0) {
                    // Only show heading if there are also outside stations
                    html += '<div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem;">In Square</div>';
                }
                html += insideStations.map(s => {
                    const meta = s.line || s.operator || '';
                    return `
                        <div class="station-item">
                            ${getStationIcon(s.type)}
                            <div class="station-info">
                                <div class="station-name">${s.name}</div>
                                ${meta ? `<div class="station-meta">${meta}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            if (outsideStations.length > 0) {
                if (insideStations.length > 0) {
                    html += '<div style="margin: 0.75rem 0 0.5rem 0; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #6b7280; font-weight: 600;">Nearby</div>';
                }
                html += outsideStations.map(s => {
                    const meta = s.line || s.operator || '';
                    const distanceText = formatDistance(s.distance);
                    return `
                        <div class="station-item">
                            ${getStationIcon(s.type)}
                            <div class="station-info">
                                <div class="station-name">${s.name}</div>
                                ${meta ? `<div class="station-meta">${meta}</div>` : ''}
                            </div>
                            <div class="station-distance">${distanceText}</div>
                        </div>
                    `;
                }).join('');
            }

            stationsContent.innerHTML = html;
        }
    } catch (error) {
        console.error('Error fetching stations:', error);
        stationsContent.innerHTML = '<p class="no-stations">Error loading stations</p>';
    }
}

// Calculate distance between two lat/lon points (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance;
}

// Calculate distance from a point to the edge of a square
function distanceToSquareEdge(pointLat, pointLon, sw, ne, nw, se) {
    // Check if point is inside the square
    const inside = pointLat >= Math.min(sw.lat, ne.lat) &&
                   pointLat <= Math.max(sw.lat, ne.lat) &&
                   pointLon >= Math.min(sw.lon, ne.lon) &&
                   pointLon <= Math.max(sw.lon, ne.lon);

    if (inside) {
        return 0; // Point is inside the square
    }

    // Calculate distance to each edge
    const distances = [];

    // Distance to south edge (sw to se)
    const southDist = distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, se.lat, se.lon);
    distances.push(southDist);

    // Distance to north edge (nw to ne)
    const northDist = distanceToLineSegment(pointLat, pointLon, nw.lat, nw.lon, ne.lat, ne.lon);
    distances.push(northDist);

    // Distance to west edge (sw to nw)
    const westDist = distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, nw.lat, nw.lon);
    distances.push(westDist);

    // Distance to east edge (se to ne)
    const eastDist = distanceToLineSegment(pointLat, pointLon, se.lat, se.lon, ne.lat, ne.lon);
    distances.push(eastDist);

    return Math.min(...distances);
}

// Calculate distance from point to line segment
function distanceToLineSegment(pointLat, pointLon, lat1, lon1, lat2, lon2) {
    // Convert to approximate cartesian (works for small distances)
    const px = pointLon;
    const py = pointLat;
    const x1 = lon1;
    const y1 = lat1;
    const x2 = lon2;
    const y2 = lat2;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    return calculateDistance(pointLat, pointLon, yy, xx);
}

// Format distance for display
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        // Show in metres for distances less than 1km
        const metres = Math.round(distanceKm * 1000);
        return `${metres} m`;
    } else {
        // Show in km with one decimal place
        return `${distanceKm.toFixed(1)} km`;
    }
}

// Get station type from tags
function getStationType(tags) {
    if (tags.station === 'subway') return 'Underground';
    if (tags.station === 'light_rail') return 'Light Rail';
    if (tags.usage === 'main') return 'Train';
    if (tags.railway === 'halt') return 'Train';
    return 'Train';
}

// Get icon for station type (Material Icons)
function getStationIcon(type) {
    const icons = {
        'Underground': '<span class="material-symbols-outlined station-icon underground">subway</span>',
        'Train': '<span class="material-symbols-outlined station-icon train">train</span>',
        'Light Rail': '<span class="material-symbols-outlined station-icon light-rail">tram</span>'
    };
    return icons[type] || '<span class="material-symbols-outlined station-icon train">train</span>';
}

// Event listeners
document.getElementById('randomize-btn').addEventListener('click', () => {
    const { easting, northing } = getRandomSquare();
    showSquareOnMap(easting, northing, 1000);
});

document.getElementById('view-10km-btn').addEventListener('click', () => {
    if (currentViewMode === '1km') {
        // Switch to 10km view - round down to nearest 10km
        const easting10km = Math.floor(original1kmEasting / 10000) * 10000;
        const northing10km = Math.floor(original1kmNorthing / 10000) * 10000;
        showSquareOnMap(easting10km, northing10km, 10000);
    } else {
        // Switch back to original 1km view
        showSquareOnMap(original1kmEasting, original1kmNorthing, 1000);
    }
});

// Initialize map on load
window.addEventListener('load', initMap);
