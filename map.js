// ========================================
// Map Management
// ========================================

// Global map and marker state
let map;
let currentMarker;
let searchExtentRectangle;

/**
 * Initializes the Leaflet map
 */
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([51.5074, -0.1278], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add right-click handler
    map.on('contextmenu', (e) => {
        handleMapRightClick(e);
    });

    // Delay to ensure map renders correctly
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

/**
 * Handles right-click on map to set grid square
 */
function handleMapRightClick(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    // Convert lat/lon to OS Grid
    const coords = latLonToOSGrid(lat, lon);

    // Snap to nearest 1km grid square
    const snapped = snapToGrid(coords.easting, coords.northing);

    // Show the square at this location
    showSquare(snapped.easting, snapped.northing, 1000);

    // Show confirmation toast
    showToast('Grid square moved here');
}

/**
 * Draws search extent rectangle on map with dotted line
 * @param {number} south - Southern boundary (latitude)
 * @param {number} west - Western boundary (longitude)
 * @param {number} north - Northern boundary (latitude)
 * @param {number} east - Eastern boundary (longitude)
 */
function drawSearchExtent(south, west, north, east) {
    // Remove existing search extent
    if (searchExtentRectangle) {
        map.removeLayer(searchExtentRectangle);
    }

    // Draw new search extent
    searchExtentRectangle = L.rectangle(
        [[south, west], [north, east]],
        {
            color: '#6b7280',
            weight: 1,
            opacity: 0.5,
            dashArray: '5, 5',
            fillOpacity: 0,
            interactive: false
        }
    ).addTo(map);
}

/**
 * Displays a square on the map and updates the UI
 * @param {number} easting - Easting coordinate
 * @param {number} northing - Northing coordinate
 * @param {number} squareSize - Size in meters (1000 or 10000)
 */
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
