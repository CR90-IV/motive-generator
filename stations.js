// ========================================
// Station Search and Display
// ========================================

// State
let stationSearchRequestId = 0;
let currentStations = [];
let stationMarkers = [];
let selectedStationIndex = null;

/**
 * Fetches from Overpass API with retry logic for 504/429 errors
 */
async function fetchOverpassWithRetry(query, thisRequestId, contentElement, retryCount = 0) {
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
        contentElement.innerHTML = `<p class="loading">${errorType}, retrying in ${delaySec}s<span class="loading-dots"></span></p>`;

        await new Promise(resolve => setTimeout(resolve, delayMs));

        contentElement.innerHTML = '<p class="loading">Retrying search<span class="loading-dots"></span></p>';
        return fetchOverpassWithRetry(query, thisRequestId, contentElement, retryCount + 1);
    }

    if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Searches for nearby railway stations
 */
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

        // Calculate 2km buffer properly accounting for lat/lon difference
        const centerLat = (sw.lat + ne.lat) / 2;
        const bufferKm = 2; // 2km buffer
        const latBuffer = bufferKm / 111.32; // ~0.018 degrees
        const lonBuffer = bufferKm / (111.32 * Math.cos(centerLat * Math.PI / 180)); // Adjust for latitude

        const south = Math.min(sw.lat, ne.lat) - latBuffer;
        const north = Math.max(sw.lat, ne.lat) + latBuffer;
        const west = Math.min(sw.lon, ne.lon) - lonBuffer;
        const east = Math.max(sw.lon, ne.lon) + lonBuffer;

        const query = `
            [out:json][timeout:25];
            (
                node["railway"="station"]["name"](${south},${west},${north},${east});
                node["railway"="halt"]["name"](${south},${west},${north},${east});
            );
            out body;
        `;

        console.log(`[Station Search #${thisRequestId}] Sending Overpass query`);

        // Draw search extent on map
        drawSearchExtent(south, west, north, east);

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
            } else if (operator && network === 'National Rail') {
                displayMeta = operator;
            } else if (network) {
                displayMeta = network;
            }

            return {
                name: station.tags.name || 'Unnamed station',
                type: getStationType(station.tags),
                meta: displayMeta,
                distance: distance,
                inside: insideSquare,
                lat: station.lat,
                lon: station.lon,
                osmType: station.type,
                osmId: station.id,
                tags: station.tags
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
                    lon: station.lon,
                    osmType: station.type,
                    osmId: station.id,
                    tags: station.tags
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

/**
 * Displays station list in UI
 */
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

/**
 * Renders a single station item
 */
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

/**
 * Adds station markers to map
 */
function addStationMarkers(stations) {
    stationMarkers.forEach(marker => map.removeLayer(marker));
    stationMarkers = [];

    stations.forEach((station, index) => {
        const iconHtml = getStationMarkerIcon(station.type);
        const icon = L.divIcon({
            html: iconHtml,
            className: 'station-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Create popup content
        let popupContent = `<div class="marker-popup"><strong>${station.name}</strong>`;
        if (station.meta) {
            popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${station.meta}</div>`;
        }
        popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${station.type}</div>`;
        if (station.distance > 0) {
            popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(station.distance)} from square</div>`;
        }

        // Add tags
        if (station.tags && Object.keys(station.tags).length > 0) {
            popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
            Object.entries(station.tags).forEach(([key, value]) => {
                popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
            });
            popupContent += `</div>`;
        }

        popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${station.osmType}/${station.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
        popupContent += `</div>`;

        const marker = L.marker([station.lat, station.lon], { icon })
            .bindPopup(popupContent, { closeButton: true, offset: [0, -16] })
            .addTo(map)
            .on('click', () => selectStation(index));

        stationMarkers.push(marker);
    });
}

/**
 * Selects a station (highlights and centers map)
 */
function selectStation(index) {
    selectedStationIndex = index;
    const station = currentStations[index];

    // Log all station information
    console.log('[Station Selected]', {
        name: station.name,
        type: station.type,
        meta: station.meta,
        tags: station.tags,
        distance: station.distance,
        inside: station.inside,
        lat: station.lat,
        lon: station.lon,
        osmType: station.osmType,
        osmId: station.osmId,
        osmUrl: `https://www.openstreetmap.org/${station.osmType}/${station.osmId}`
    });

    // Update UI selection
    document.querySelectorAll('.station-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // Clear POI/amenity selections
    document.querySelectorAll('.poi-item, .amenity-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Remove all marker highlights
    stationMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });
    if (typeof poiMarkers !== 'undefined') {
        poiMarkers.forEach(m => {
            const elem = m.getElement();
            if (elem) elem.classList.remove('marker-highlight');
        });
    }
    if (typeof amenityMarkers !== 'undefined') {
        amenityMarkers.forEach(m => {
            const elem = m.getElement();
            if (elem) elem.classList.remove('marker-highlight');
        });
    }

    // Clear all polygons
    if (typeof poiPolygons !== 'undefined') {
        poiPolygons.forEach(polygon => map.removeLayer(polygon));
        poiPolygons.length = 0;
    }
    if (typeof amenityPolygons !== 'undefined') {
        amenityPolygons.forEach(polygon => map.removeLayer(polygon));
        amenityPolygons.length = 0;
    }

    // Highlight selected station marker
    const selectedMarker = stationMarkers[index];
    if (selectedMarker) {
        const elem = selectedMarker.getElement();
        if (elem) elem.classList.add('marker-highlight');
    }

    // Center map on station
    map.panTo([station.lat, station.lon]);

    // Collapse sheet on mobile to show map
    if (window.innerWidth < 768 && sheetState === 'full') {
        setSheetState('peek');
    }
}

/**
 * Determines station type from OSM tags
 */
function getStationType(tags) {
    if (tags.station === 'subway') return 'Underground';
    if (tags.station === 'light_rail') return 'Light Rail';
    if (tags.usage === 'main') return 'Train';
    if (tags.railway === 'halt') return 'Train';
    return 'Train';
}

/**
 * Returns icon HTML for station type
 */
function getStationIcon(type) {
    const icons = {
        'Underground': '<span class="material-symbols-outlined station-icon underground">subway</span>',
        'Train': '<span class="material-symbols-outlined station-icon train">train</span>',
        'Light Rail': '<span class="material-symbols-outlined station-icon light-rail">tram</span>'
    };
    return icons[type] || '<span class="material-symbols-outlined station-icon train">train</span>';
}

/**
 * Returns marker icon HTML for station type
 */
function getStationMarkerIcon(type) {
    const icons = {
        'Underground': 'subway',
        'Train': 'train',
        'Light Rail': 'tram'
    };
    const colors = {
        'Underground': '#dc2626',
        'Train': '#3b82f6',
        'Light Rail': '#059669'
    };
    const icon = icons[type] || 'train';
    const color = colors[type] || '#3b82f6';

    return `
        <div style="
            width: 32px;
            height: 32px;
            background: ${hexToRgba(color, 0.95)};
            border: 2px solid white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
            <span class="material-symbols-outlined" style="
                font-size: 20px;
                color: white;
                font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
            ">${icon}</span>
        </div>
    `;
}
