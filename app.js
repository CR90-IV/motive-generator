// ========================================
// Ordnance Survey Grid Conversion
// ========================================

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

function get10kmGridRef(gridRef) {
    if (gridRef.length >= 4) {
        return gridRef.substring(0, 2) + gridRef.charAt(2) + gridRef.charAt(4);
    }
    return gridRef;
}

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

// ========================================
// Constants
// ========================================

const LONDON_BOUNDS = {
    minEasting: 503000,
    maxEasting: 561000,
    minNorthing: 155000,
    maxNorthing: 200000
};

// ========================================
// State Management
// ========================================

let map;
let currentMarker;
let stationMarkers = [];
let currentEasting;
let currentNorthing;
let original1kmEasting;
let original1kmNorthing;
let currentViewMode = '1km';
let stationSearchRequestId = 0;
let poiSearchRequestId = 0;
let currentStations = [];
let currentPOIs = [];
let selectedStationIndex = null;
let selectedPOIIndex = null;
let poiMarkers = [];

// Sheet state (mobile)
let sheetState = 'hidden'; // 'hidden', 'peek', 'full'

// ========================================
// Initialization
// ========================================

function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([51.5074, -0.1278], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Delay to ensure map renders correctly
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

function initSheet() {
    const toggleBtn = document.getElementById('sheet-toggle');

    // Toggle button click handler
    toggleBtn.addEventListener('click', () => {
        if (sheetState === 'peek') {
            setSheetState('full');
            toggleBtn.setAttribute('aria-label', 'Collapse sheet');
        } else if (sheetState === 'full') {
            setSheetState('peek');
            toggleBtn.setAttribute('aria-label', 'Expand sheet');
        }
    });
}

function setSheetState(state) {
    const sheet = document.getElementById('sheet');
    sheet.classList.remove('hidden', 'peek', 'full');
    sheet.classList.add(state);
    sheetState = state;
}

// ========================================
// UI Updates
// ========================================

function showSquare(easting, northing, squareSize = 1000) {
    currentEasting = easting;
    currentNorthing = northing;
    currentViewMode = squareSize === 1000 ? '1km' : '10km';

    if (squareSize === 1000) {
        original1kmEasting = easting;
        original1kmNorthing = northing;
    }

    const center = osGridToLatLon(easting + squareSize / 2, northing + squareSize / 2);
    const gridRef = squareSize === 1000 ? formatGridRef(easting, northing) : get10kmGridRef(formatGridRef(easting, northing));

    // Remove previous marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Draw square on map
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
        fillOpacity: 0.15,
        weight: 2
    }).addTo(map);

    currentMarker = square;

    // Update sheet content
    document.getElementById('grid-ref-input').value = gridRef;

    // Update Google Maps link
    const googleMapsLink = `https://www.google.com/maps?q=${center.lat},${center.lon}`;
    document.getElementById('google-maps-link').href = googleMapsLink;

    // Update 10km button
    const view10kmBtn = document.getElementById('view-10km-btn');
    const btnIcon = view10kmBtn.querySelector('.material-symbols-outlined');
    const btnLabel = view10kmBtn.querySelector('.btn-label');

    if (squareSize === 1000) {
        btnIcon.textContent = 'open_in_full';
        btnLabel.textContent = '10km';
    } else {
        btnIcon.textContent = 'close_fullscreen';
        btnLabel.textContent = '1km';
    }

    // Show sheet if hidden
    if (sheetState === 'hidden') {
        setSheetState('peek');
    }

    // Hide empty state
    document.getElementById('empty-state').classList.add('hidden');

    // Fit map to bounds
    setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(square.getBounds(), { padding: [50, 50] });
    }, 100);

    // Show toast
    showToast(`Generated ${gridRef}`);

    // Update URL
    updateURL(gridRef);

    // Find stations and POIs
    findNearbyStations(easting, northing, squareSize);
    findNearbyPOIs(easting, northing, squareSize);
}

function getRandomSquare() {
    const easting = Math.floor(Math.random() * (LONDON_BOUNDS.maxEasting - LONDON_BOUNDS.minEasting) / 1000) * 1000 + LONDON_BOUNDS.minEasting;
    const northing = Math.floor(Math.random() * (LONDON_BOUNDS.maxNorthing - LONDON_BOUNDS.minNorthing) / 1000) * 1000 + LONDON_BOUNDS.minNorthing;
    return { easting, northing };
}

// ========================================
// Station Search
// ========================================

async function fetchOverpassWithRetry(query, thisRequestId, stationsContent, retryCount = 0) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
    });

    console.log(`[Station Search #${thisRequestId}] Response status: ${response.status} ${response.statusText}`);

    if ((response.status === 504 || response.status === 429) && retryCount === 0) {
        const delayMs = response.status === 429 ? 3000 : 2000;
        const delaySec = delayMs / 1000;
        const errorType = response.status === 429 ? 'Rate limited' : 'Server timeout';

        console.log(`[Station Search #${thisRequestId}] ${errorType}, waiting ${delaySec}s before retry`);
        stationsContent.innerHTML = `<p class="loading">${errorType}, retrying in ${delaySec}s<span class="loading-dots"></span></p>`;

        await new Promise(resolve => setTimeout(resolve, delayMs));

        stationsContent.innerHTML = '<p class="loading">Retrying search<span class="loading-dots"></span></p>';
        return fetchOverpassWithRetry(query, thisRequestId, stationsContent, retryCount + 1);
    }

    if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

async function findNearbyStations(easting, northing, squareSize) {
    stationSearchRequestId++;
    const thisRequestId = stationSearchRequestId;
    console.log(`[Station Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const stationsContent = document.getElementById('stations-content');
    stationsContent.innerHTML = '<p class="loading">Finding stations<span class="loading-dots"></span></p>';

    // Clear existing station markers
    stationMarkers.forEach(marker => map.removeLayer(marker));
    stationMarkers = [];
    currentStations = [];
    selectedStationIndex = null;

    try {
        const sw = osGridToLatLon(easting, northing);
        const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
        const nw = osGridToLatLon(easting, northing + squareSize);
        const se = osGridToLatLon(easting + squareSize, northing);
        const center = osGridToLatLon(easting + squareSize / 2, northing + squareSize / 2);

        let buffer = 0.02;
        const south = Math.min(sw.lat, ne.lat) - buffer;
        const north = Math.max(sw.lat, ne.lat) + buffer;
        const west = Math.min(sw.lon, ne.lon) - buffer;
        const east = Math.max(sw.lon, ne.lon) + buffer;

        const query = `
            [out:json][timeout:25];
            (
                node["railway"="station"]["name"](${south},${west},${north},${east});
                node["railway"="halt"]["name"](${south},${west},${north},${east});
            );
            out body;
        `;

        console.log(`[Station Search #${thisRequestId}] Sending Overpass query`);
        const data = await fetchOverpassWithRetry(query, thisRequestId, stationsContent);
        console.log(`[Station Search #${thisRequestId}] Found ${data.elements?.length || 0} stations in initial search`);

        const stations = data.elements.map(station => {
            const distance = distanceToSquareEdge(station.lat, station.lon, sw, ne, nw, se);
            const insideSquare = distance === 0;

            // Get metadata fields
            const line = station.tags.line || station.tags['line:name'] || null;
            const network = station.tags.network || null;
            const operator = station.tags.operator || null;

            // Determine what to display: line > network > operator (if network is National Rail)
            let displayMeta = null;
            if (line) {
                displayMeta = formatLineName(line);
            } else if (network) {
                displayMeta = network;
            } else if (operator && network === 'National Rail') {
                displayMeta = operator;
            }

            return {
                name: station.tags.name || 'Unnamed station',
                type: getStationType(station.tags),
                meta: displayMeta,
                distance: distance,
                inside: insideSquare,
                lat: station.lat,
                lon: station.lon
            };
        }).filter(s => s.name !== 'Unnamed station')
          .sort((a, b) => {
              if (a.inside && !b.inside) return -1;
              if (!a.inside && b.inside) return 1;
              return a.distance - b.distance;
          });

        if (stations.length === 0) {
            console.log(`[Station Search #${thisRequestId}] No stations found, expanding search`);
            stationsContent.innerHTML = '<p class="loading">No nearby stations, searching wider area<span class="loading-dots"></span></p>';

            const widerQuery = `
                [out:json][timeout:25];
                (
                    node["railway"="station"]["name"](around:10000,${center.lat},${center.lon});
                    node["railway"="halt"]["name"](around:10000,${center.lat},${center.lon});
                );
                out body;
            `;

            const widerData = await fetchOverpassWithRetry(widerQuery, thisRequestId, stationsContent);
            console.log(`[Station Search #${thisRequestId}] Found ${widerData.elements?.length || 0} stations in wider search`);

            const allStations = widerData.elements.map(station => {
                const distance = distanceToSquareEdge(station.lat, station.lon, sw, ne, nw, se);

                // Get metadata fields
                const line = station.tags.line || station.tags['line:name'] || null;
                const network = station.tags.network || null;
                const operator = station.tags.operator || null;

                // Determine what to display: line > network > operator (if network is National Rail)
                let displayMeta = null;
                if (line) {
                    displayMeta = formatLineName(line);
                } else if (network) {
                    displayMeta = network;
                } else if (operator && network === 'National Rail') {
                    displayMeta = operator;
                }

                return {
                    name: station.tags.name || 'Unnamed station',
                    type: getStationType(station.tags),
                    meta: displayMeta,
                    distance: distance,
                    inside: false,
                    lat: station.lat,
                    lon: station.lon
                };
            }).filter(s => s.name !== 'Unnamed station')
              .sort((a, b) => a.distance - b.distance);

            stations.push(...allStations.slice(0, 1));
        }

        // Check if still latest request
        if (thisRequestId !== stationSearchRequestId) {
            console.log(`[Station Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentStations = stations;
        displayStations(stations);
        addStationMarkers(stations);

    } catch (error) {
        console.error(`[Station Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== stationSearchRequestId) {
            return;
        }

        stationsContent.innerHTML = '<p class="no-stations">Error loading stations</p>';
    }
}

function displayStations(stations) {
    const stationsContent = document.getElementById('stations-content');

    if (stations.length === 0) {
        stationsContent.innerHTML = '<p class="no-stations">No stations found nearby</p>';
        return;
    }

    const insideStations = stations.filter(s => s.inside);
    const outsideStations = stations.filter(s => !s.inside).slice(0, 5);

    let html = '';

    if (insideStations.length > 0) {
        if (outsideStations.length > 0) {
            html += '<div class="station-group-header">In Square</div>';
        }
        html += insideStations.map((s, idx) => renderStationItem(s, stations.indexOf(s))).join('');
    }

    if (outsideStations.length > 0) {
        if (insideStations.length > 0) {
            html += '<div class="station-group-header">Nearby</div>';
        }
        html += outsideStations.map((s, idx) => renderStationItem(s, stations.indexOf(s))).join('');
    }

    stationsContent.innerHTML = html;

    // Add click listeners
    document.querySelectorAll('.station-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectStation(index);
        });
    });
}

function renderStationItem(station, index) {
    const distanceText = station.distance > 0 ? formatDistance(station.distance) : '';

    return `
        <div class="station-item" data-index="${index}">
            ${getStationIcon(station.type)}
            <div class="station-info">
                <div class="station-name">${station.name}</div>
                ${station.meta ? `<div class="station-meta">${station.meta}</div>` : ''}
            </div>
            ${distanceText ? `<div class="station-distance">${distanceText}</div>` : ''}
        </div>
    `;
}

function addStationMarkers(stations) {
    stationMarkers.forEach(marker => map.removeLayer(marker));
    stationMarkers = [];

    stations.forEach((station, index) => {
        const iconHtml = getStationMarkerIcon(station.type);
        const icon = L.divIcon({
            html: iconHtml,
            className: 'station-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([station.lat, station.lon], { icon })
            .addTo(map)
            .on('click', () => selectStation(index));

        stationMarkers.push(marker);
    });
}

function selectStation(index) {
    selectedStationIndex = index;
    const station = currentStations[index];

    // Update UI selection
    document.querySelectorAll('.station-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Center map on station
    map.panTo([station.lat, station.lon]);

    // Expand sheet on mobile
    if (window.innerWidth < 768 && sheetState === 'peek') {
        setSheetState('full');
    }
}

function getStationMarkerIcon(type) {
    const colors = {
        'Underground': '#dc2626',
        'Train': '#3b82f6',
        'Light Rail': '#059669'
    };
    const color = colors[type] || '#3b82f6';

    return `
        <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
    `;
}

// ========================================
// POI Search
// ========================================

async function findNearbyPOIs(easting, northing, squareSize) {
    poiSearchRequestId++;
    const thisRequestId = poiSearchRequestId;
    console.log(`[POI Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const poiContent = document.getElementById('poi-content');
    poiContent.innerHTML = '<p class="loading">Finding places<span class="loading-dots"></span></p>';

    // Clear existing POI markers
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
    currentPOIs = [];
    selectedPOIIndex = null;

    try {
        const sw = osGridToLatLon(easting, northing);
        const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
        const nw = osGridToLatLon(easting, northing + squareSize);
        const se = osGridToLatLon(easting + squareSize, northing);

        let buffer = 0.02;
        const south = Math.min(sw.lat, ne.lat) - buffer;
        const north = Math.max(sw.lat, ne.lat) + buffer;
        const west = Math.min(sw.lon, ne.lon) - buffer;
        const east = Math.max(sw.lon, ne.lon) + buffer;

        // Overpass query for various POI types
        const query = `
            [out:json][timeout:25];
            (
                node["leisure"="park"]["name"](${south},${west},${north},${east});
                way["leisure"="park"]["name"](${south},${west},${north},${east});
                node["tourism"="museum"]["name"](${south},${west},${north},${east});
                way["tourism"="museum"]["name"](${south},${west},${north},${east});
                node["historic"~"memorial|monument"]["name"](${south},${west},${north},${east});
                node["amenity"="library"]["name"](${south},${west},${north},${east});
                node["amenity"="theatre"]["name"](${south},${west},${north},${east});
                node["amenity"="cinema"]["name"](${south},${west},${north},${east});
                node["tourism"="attraction"]["name"](${south},${west},${north},${east});
                node["tourism"="viewpoint"]["name"](${south},${west},${north},${east});
            );
            out center;
        `;

        console.log(`[POI Search #${thisRequestId}] Sending Overpass query`);
        const data = await fetchOverpassWithRetry(query, thisRequestId, poiContent);
        console.log(`[POI Search #${thisRequestId}] Found ${data.elements?.length || 0} POIs`);

        const pois = data.elements.map(poi => {
            // Get center point (for ways, use center; for nodes, use lat/lon)
            const lat = poi.center ? poi.center.lat : poi.lat;
            const lon = poi.center ? poi.center.lon : poi.lon;

            const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);
            const insideSquare = distance === 0;

            return {
                name: poi.tags.name || 'Unnamed place',
                type: getPOIType(poi.tags),
                distance: distance,
                inside: insideSquare,
                lat: lat,
                lon: lon
            };
        }).filter(p => p.name !== 'Unnamed place')
          .sort((a, b) => {
              if (a.inside && !b.inside) return -1;
              if (!a.inside && b.inside) return 1;
              return a.distance - b.distance;
          });

        // Check if still latest request
        if (thisRequestId !== poiSearchRequestId) {
            console.log(`[POI Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentPOIs = pois;
        displayPOIs(pois);
        addPOIMarkers(pois);

    } catch (error) {
        console.error(`[POI Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== poiSearchRequestId) {
            return;
        }

        poiContent.innerHTML = '<p class="no-stations">Error loading places</p>';
    }
}

function displayPOIs(pois) {
    const poiContent = document.getElementById('poi-content');

    if (pois.length === 0) {
        poiContent.innerHTML = '<p class="no-stations">No notable places found</p>';
        return;
    }

    const insidePOIs = pois.filter(p => p.inside);
    const outsidePOIs = pois.filter(p => !p.inside).slice(0, 10);

    let html = '';

    if (insidePOIs.length > 0) {
        if (outsidePOIs.length > 0) {
            html += '<div class="station-group-header">In Square</div>';
        }
        html += insidePOIs.map((p, idx) => renderPOIItem(p, pois.indexOf(p))).join('');
    }

    if (outsidePOIs.length > 0) {
        if (insidePOIs.length > 0) {
            html += '<div class="station-group-header">Nearby</div>';
        }
        html += outsidePOIs.map((p, idx) => renderPOIItem(p, pois.indexOf(p))).join('');
    }

    poiContent.innerHTML = html;

    // Add click listeners
    document.querySelectorAll('.poi-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectPOI(index);
        });
    });
}

function renderPOIItem(poi, index) {
    const distanceText = poi.distance > 0 ? formatDistance(poi.distance) : '';

    return `
        <div class="poi-item station-item" data-index="${index}">
            ${getPOIIcon(poi.type)}
            <div class="station-info">
                <div class="station-name">${poi.name}</div>
                <div class="station-meta">${poi.type}</div>
            </div>
            ${distanceText ? `<div class="station-distance">${distanceText}</div>` : ''}
        </div>
    `;
}

function addPOIMarkers(pois) {
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];

    pois.forEach((poi, index) => {
        const iconHtml = getPOIMarkerIcon(poi.type);
        const icon = L.divIcon({
            html: iconHtml,
            className: 'poi-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([poi.lat, poi.lon], { icon })
            .addTo(map)
            .on('click', () => selectPOI(index));

        poiMarkers.push(marker);
    });
}

function selectPOI(index) {
    selectedPOIIndex = index;
    const poi = currentPOIs[index];

    // Update UI selection
    document.querySelectorAll('.poi-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Center map on POI
    map.panTo([poi.lat, poi.lon]);

    // Expand sheet on mobile
    if (window.innerWidth < 768 && sheetState === 'peek') {
        setSheetState('full');
    }
}

function getPOIType(tags) {
    if (tags.leisure === 'park') return 'Park';
    if (tags.tourism === 'museum') return 'Museum';
    if (tags.historic === 'memorial') return 'Memorial';
    if (tags.historic === 'monument') return 'Monument';
    if (tags.amenity === 'library') return 'Library';
    if (tags.amenity === 'theatre') return 'Theatre';
    if (tags.amenity === 'cinema') return 'Cinema';
    if (tags.tourism === 'attraction') return 'Attraction';
    if (tags.tourism === 'viewpoint') return 'Viewpoint';
    return 'Place';
}

function getPOIIcon(type) {
    const icons = {
        'Park': '<span class="material-symbols-outlined station-icon" style="color: #059669;">park</span>',
        'Museum': '<span class="material-symbols-outlined station-icon" style="color: #8b5cf6;">museum</span>',
        'Memorial': '<span class="material-symbols-outlined station-icon" style="color: #6b7280;">chess_rook</span>',
        'Monument': '<span class="material-symbols-outlined station-icon" style="color: #6b7280;">chess_rook</span>',
        'Library': '<span class="material-symbols-outlined station-icon" style="color: #0891b2;">local_library</span>',
        'Theatre': '<span class="material-symbols-outlined station-icon" style="color: #ec4899;">theater_comedy</span>',
        'Cinema': '<span class="material-symbols-outlined station-icon" style="color: #dc2626;">local_movies</span>',
        'Attraction': '<span class="material-symbols-outlined station-icon" style="color: #f59e0b;">attractions</span>',
        'Viewpoint': '<span class="material-symbols-outlined station-icon" style="color: #3b82f6;">visibility</span>',
    };
    return icons[type] || '<span class="material-symbols-outlined station-icon" style="color: #6b7280;">place</span>';
}

function getPOIMarkerIcon(type) {
    const colors = {
        'Park': '#059669',
        'Museum': '#8b5cf6',
        'Memorial': '#6b7280',
        'Monument': '#6b7280',
        'Library': '#0891b2',
        'Theatre': '#ec4899',
        'Cinema': '#dc2626',
        'Attraction': '#f59e0b',
        'Viewpoint': '#3b82f6',
    };
    const color = colors[type] || '#6b7280';

    return `
        <div style="
            width: 18px;
            height: 18px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
    `;
}

// ========================================
// Helper Functions
// ========================================

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function distanceToSquareEdge(pointLat, pointLon, sw, ne, nw, se) {
    const inside = pointLat >= Math.min(sw.lat, ne.lat) &&
                   pointLat <= Math.max(sw.lat, ne.lat) &&
                   pointLon >= Math.min(sw.lon, ne.lon) &&
                   pointLon <= Math.max(sw.lon, ne.lon);

    if (inside) return 0;

    const distances = [
        distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, se.lat, se.lon),
        distanceToLineSegment(pointLat, pointLon, nw.lat, nw.lon, ne.lat, ne.lon),
        distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, nw.lat, nw.lon),
        distanceToLineSegment(pointLat, pointLon, se.lat, se.lon, ne.lat, ne.lon)
    ];

    return Math.min(...distances);
}

function distanceToLineSegment(pointLat, pointLon, lat1, lon1, lat2, lon2) {
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
    let param = lenSq !== 0 ? dot / lenSq : -1;

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

function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}

function formatLineName(line) {
    if (!line) return null;

    const lines = line.split(';')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => {
            return l.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        });

    return lines.join(', ');
}

function getStationType(tags) {
    if (tags.station === 'subway') return 'Underground';
    if (tags.station === 'light_rail') return 'Light Rail';
    if (tags.usage === 'main') return 'Train';
    if (tags.railway === 'halt') return 'Train';
    return 'Train';
}

function getStationIcon(type) {
    const icons = {
        'Underground': '<span class="material-symbols-outlined station-icon underground">subway</span>',
        'Train': '<span class="material-symbols-outlined station-icon train">train</span>',
        'Light Rail': '<span class="material-symbols-outlined station-icon light-rail">tram</span>'
    };
    return icons[type] || '<span class="material-symbols-outlined station-icon train">train</span>';
}

// ========================================
// Grid Reference Input
// ========================================

function setupGridRefInput() {
    const input = document.getElementById('grid-ref-input');

    function validateAndLoadGridRef() {
        const value = input.value.trim();

        if (!value) {
            return;
        }

        const parsed = parseGridRef(value);
        if (parsed) {
            // Valid grid reference
            input.classList.remove('error');
            const squareSize = parsed.precision;
            const normalizedGridRef = value.toUpperCase().replace(/\s/g, '');
            showSquare(parsed.easting, parsed.northing, squareSize);
            updateURL(normalizedGridRef);
        } else {
            // Invalid grid reference
            input.classList.add('error');
            showToast('Invalid grid reference');
            setTimeout(() => {
                input.classList.remove('error');
            }, 300);
        }
    }

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateAndLoadGridRef();
            input.blur(); // Unfocus after submitting
        }
    });

    // Handle blur (when user clicks away)
    input.addEventListener('blur', () => {
        validateAndLoadGridRef();
    });

    // Auto-uppercase as user types
    input.addEventListener('input', () => {
        const cursorPos = input.selectionStart;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(cursorPos, cursorPos);
    });
}

// ========================================
// URL Sharing
// ========================================

function updateURL(gridRef) {
    const url = new URL(window.location.href);
    url.searchParams.set('grid', gridRef);
    window.history.replaceState({}, '', url.toString());
}

function loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const gridParam = urlParams.get('grid');

    if (gridParam) {
        const parsed = parseGridRef(gridParam);
        if (parsed) {
            const squareSize = parsed.precision;
            showSquare(parsed.easting, parsed.northing, squareSize);
            return true;
        }
    }
    return false;
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// ========================================
// Toast Notifications
// ========================================

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => {
            container.removeChild(toast);
        }, 200);
    }, 2000);
}

// ========================================
// Event Listeners
// ========================================

document.getElementById('randomize-btn').addEventListener('click', () => {
    const { easting, northing } = getRandomSquare();
    showSquare(easting, northing, 1000);
});

document.getElementById('view-10km-btn').addEventListener('click', () => {
    if (currentViewMode === '1km') {
        const easting10km = Math.floor(original1kmEasting / 10000) * 10000;
        const northing10km = Math.floor(original1kmNorthing / 10000) * 10000;
        showSquare(easting10km, northing10km, 10000);
    } else {
        showSquare(original1kmEasting, original1kmNorthing, 1000);
    }
});

document.getElementById('share-btn').addEventListener('click', () => {
    const url = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: 'London Grid Square',
            text: 'Check out this grid square',
            url: url
        }).catch(() => {
            copyToClipboard(url);
            showToast('Link copied!');
        });
    } else {
        copyToClipboard(url);
        showToast('Link copied!');
    }
});

// ========================================
// Initialize on Load
// ========================================

window.addEventListener('load', () => {
    initMap();
    initSheet();
    setupGridRefInput();

    // Load from URL if present
    const loadedFromURL = loadFromURL();

    // If nothing loaded from URL, keep empty state visible
    if (!loadedFromURL) {
        // Empty state is visible by default
    }
});
