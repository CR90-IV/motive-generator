// ========================================
// Station Search and Display
// ========================================

// State
let stationSearchRequestId = 0;
let currentStations = [];
let stationMarkers = [];
let selectedStationIndex = null;

/**
 * Searches for nearby railway stations
 */
async function findNearbyStations(easting, northing, squareSize, stationsData = null, bounds = null) {
    stationSearchRequestId++;
    const thisRequestId = stationSearchRequestId;
    console.log(`[Station Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const stationsContent = document.getElementById('stations-content');
    stationsContent.innerHTML = '<p class="loading">Finding stations<span class="loading-dots"></span></p>';

    // Clear existing station markers
    removeMarkers(stationMarkers);
    currentStations = [];
    selectedStationIndex = null;

    try {
        const squareCorners = getSquareCorners(easting, northing, squareSize);
        let stations = [];

        if (stationsData) {
            // Use provided data (from combined query)
            stations = stationsData;
        } else {
            // Fallback: fetch separately if needed
            const boundsData = bounds || calculateSearchBounds(easting, northing, squareSize);
            const { south, north, west, east, sw, ne } = boundsData;

            const query = `
                [out:json][timeout:25];
                (
                    node["railway"="station"]["name"](${south},${west},${north},${east});
                    node["railway"="halt"]["name"](${south},${west},${north},${east});
                );
                out body;
            `;

            const data = await fetchOverpassWithRetry(query, thisRequestId, stationsContent);
            stations = data.elements;

            // Draw search extent on map
            drawSearchExtent(south, west, north, east);
        }

        // Process stations
        const processedStations = processStations(stations, squareCorners);

        // If no stations found, search wider area
        if (processedStations.length === 0) {
            const widerStations = await fetchStationsWithFallback(easting, northing, squareSize, [], thisRequestId);
            processedStations.push(...processStations(widerStations, squareCorners));
        }

        // Check if still latest request
        if (thisRequestId !== stationSearchRequestId) {
            console.log(`[Station Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentStations = processedStations;
        displayStations(processedStations);
        addStationMarkers(processedStations);

    } catch (error) {
        console.error(`[Station Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== stationSearchRequestId) {
            return;
        }

        stationsContent.innerHTML = '<p class="no-stations">Error loading stations</p>';
    }
}

/**
 * Processes raw station data into display format
 */
function processStations(stations, squareCorners) {
    return stations.map(station => {
        const coords = extractGeometry(station);
        if (!coords) return null;

        const { lat, lon } = coords;
        const { sw, ne, nw, se } = squareCorners;
        const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);

        return {
            name: station.tags.name || 'Unnamed station',
            type: getStationType(station.tags),
            meta: extractStationMetadata(station.tags),
            metadata: extractStationMetadata(station.tags),
            distance,
            inside: distance === 0,
            lat,
            lon,
            osmType: station.type,
            osmId: station.id,
            tags: station.tags
        };
    })
    .filter(s => s && s.name !== 'Unnamed station')
    .sort((a, b) => {
        if (a.inside && !b.inside) return -1;
        if (!a.inside && b.inside) return 1;
        return a.distance - b.distance;
    });
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
            ${createStationIcon(station.type)}
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
    removeMarkers(stationMarkers);

    stations.forEach((station, index) => {
        const iconHtml = createStationMarkerIcon(station.type);
        const marker = createMarker(station, iconHtml, 'station-marker', [32, 32], () => selectStation(index));
        stationMarkers.push(marker);
    });
}

/**
 * Selects a station (highlights and centers map)
 */
function selectStation(index) {
    selectedStationIndex = index;
    const station = currentStations[index];

    // Log station information
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
        item.classList.toggle('selected', idx === index);
    });

    // Clear POI/amenity selections
    document.querySelectorAll('.poi-item, .amenity-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Clear all marker highlights and polygons
    clearAllMarkerHighlights([stationMarkers, poiMarkers, amenityMarkers]);
    clearPolygons();

    // Highlight selected station marker
    highlightMarker(stationMarkers[index]);

    // Center map on station
    map.panTo([station.lat, station.lon]);

    // Collapse sheet on mobile to show map
    if (window.innerWidth < 768 && sheetState === 'full') {
        setSheetState('peek');
    }
}
