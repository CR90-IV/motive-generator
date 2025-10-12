// ========================================
// POI and Amenities Search and Display
// ========================================

// State
let poiSearchRequestId = 0;
let amenitySearchRequestId = 0;
let currentPOIs = [];
let currentAmenities = [];
let poiMarkers = [];
let amenityMarkers = [];
let selectedPOIIndex = null;
let selectedAmenityIndex = null;
let activePOIFilters = new Set();
let activeAmenityFilters = new Set();

/**
 * Searches for nearby points of interest
 */
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

        // Expanded Overpass query for broader POI categories
        const query = `
            [out:json][timeout:25];
            (
                node["leisure"]["name"](${south},${west},${north},${east});
                way["leisure"]["name"](${south},${west},${north},${east});
                node["natural"="peak"]["name"](${south},${west},${north},${east});
                node["natural"="water"]["name"](${south},${west},${north},${east});
                way["natural"="water"]["name"](${south},${west},${north},${east});
                node["waterway"]["name"](${south},${west},${north},${east});
                way["waterway"]["name"](${south},${west},${north},${east});
                node["tourism"]["name"](${south},${west},${north},${east});
                way["tourism"]["name"](${south},${west},${north},${east});
                node["amenity"="library"]["name"](${south},${west},${north},${east});
                node["amenity"="university"]["name"](${south},${west},${north},${east});
                way["amenity"="university"]["name"](${south},${west},${north},${east});
                node["man_made"="bridge"]["name"](${south},${west},${north},${east});
                way["bridge"]["name"](${south},${west},${north},${east});
                node["historic"]["name"](${south},${west},${north},${east});
                way["historic"]["name"](${south},${west},${north},${east});
                node["aeroway"~"aerodrome|airport"]["name"](${south},${west},${north},${east});
                way["aeroway"~"aerodrome|airport"]["name"](${south},${west},${north},${east});
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

            // Extract metadata from tags
            const metadata = extractPOIMetadata(poi.tags);

            return {
                name: poi.tags.name || 'Unnamed place',
                metadata: metadata,
                tags: poi.tags,
                distance: distance,
                inside: insideSquare,
                lat: lat,
                lon: lon
            };
        }).filter(p => p.name !== 'Unnamed place')
          .sort((a, b) => {
              if (a.inside && !b.inside) return -1;
              if (!a.inside && b.inside) return 1;

              // Within square: sort by type (metadata), outside: sort by distance
              if (a.inside && b.inside) {
                  const typeA = a.metadata || '';
                  const typeB = b.metadata || '';
                  return typeA.localeCompare(typeB);
              }

              return a.distance - b.distance;
          });

        // Check if still latest request
        if (thisRequestId !== poiSearchRequestId) {
            console.log(`[POI Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentPOIs = pois;
        activePOIFilters.clear();
        displayPOIs(pois);
        // Don't add POI markers automatically - only show when clicked

    } catch (error) {
        console.error(`[POI Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== poiSearchRequestId) {
            return;
        }

        poiContent.innerHTML = '<p class="no-stations">Error loading places</p>';
    }

    // Also search for amenities
    findNearbyAmenities(easting, northing, squareSize);
}

/**
 * Searches for nearby amenities (drinking water, cafes, hotels, toilets)
 */
async function findNearbyAmenities(easting, northing, squareSize) {
    amenitySearchRequestId++;
    const thisRequestId = amenitySearchRequestId;
    console.log(`[Amenity Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const amenitiesContent = document.getElementById('amenities-content');
    amenitiesContent.innerHTML = '<p class="loading">Finding amenities<span class="loading-dots"></span></p>';

    // Clear existing amenity markers
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];
    currentAmenities = [];
    selectedAmenityIndex = null;

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

        // Query for specific amenities
        const query = `
            [out:json][timeout:25];
            (
                node["amenity"="drinking_water"](${south},${west},${north},${east});
                node["amenity"="hotel"]["name"](${south},${west},${north},${east});
                way["amenity"="hotel"]["name"](${south},${west},${north},${east});
                node["amenity"="toilets"](${south},${west},${north},${east});
            );
            out center;
        `;

        console.log(`[Amenity Search #${thisRequestId}] Sending Overpass query`);
        const data = await fetchOverpassWithRetry(query, thisRequestId, amenitiesContent);
        console.log(`[Amenity Search #${thisRequestId}] Found ${data.elements?.length || 0} amenities`);

        const amenities = data.elements.map(amenity => {
            const lat = amenity.center ? amenity.center.lat : amenity.lat;
            const lon = amenity.center ? amenity.center.lon : amenity.lon;

            const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);
            const insideSquare = distance === 0;

            // Extract metadata from tags
            const metadata = extractPOIMetadata(amenity.tags);

            return {
                name: amenity.tags.name || getAmenityDefaultName(amenity.tags),
                metadata: metadata,
                tags: amenity.tags,
                distance: distance,
                inside: insideSquare,
                lat: lat,
                lon: lon
            };
        }).sort((a, b) => {
            if (a.inside && !b.inside) return -1;
            if (!a.inside && b.inside) return 1;
            return a.distance - b.distance;
        });

        // Check if still latest request
        if (thisRequestId !== amenitySearchRequestId) {
            console.log(`[Amenity Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentAmenities = amenities;
        activeAmenityFilters.clear();
        displayAmenities(amenities);
        // Don't add amenity markers automatically - only show when clicked

    } catch (error) {
        console.error(`[Amenity Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== amenitySearchRequestId) {
            return;
        }

        amenitiesContent.innerHTML = '<p class="no-stations">Error loading amenities</p>';
    }
}

/**
 * Extracts display metadata from OSM tags
 */
function extractPOIMetadata(tags) {
    const metadata = [];

    // Priority order for metadata display
    if (tags.leisure) metadata.push(formatTagValue('leisure', tags.leisure));
    if (tags.natural) metadata.push(formatTagValue('natural', tags.natural));
    if (tags.waterway) metadata.push(formatTagValue('waterway', tags.waterway));
    if (tags.tourism) metadata.push(formatTagValue('tourism', tags.tourism));
    if (tags.historic) metadata.push(formatTagValue('historic', tags.historic));
    if (tags.amenity) metadata.push(formatTagValue('amenity', tags.amenity));
    if (tags.man_made) metadata.push(formatTagValue('man_made', tags.man_made));
    if (tags.building && tags.building !== 'yes') metadata.push(formatTagValue('building', tags.building));
    if (tags.aeroway) metadata.push(formatTagValue('aeroway', tags.aeroway));
    if (tags.bridge && tags.bridge !== 'yes') metadata.push(formatTagValue('bridge', tags.bridge));

    return metadata.length > 0 ? metadata.join(' • ') : null;
}

/**
 * Formats tag values for display (converts underscores, capitalizes)
 */
function formatTagValue(key, value) {
    const formatted = value.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    return formatted;
}

/**
 * Gets default name for unnamed amenities
 */
function getAmenityDefaultName(tags) {
    if (tags.amenity === 'drinking_water') return 'Drinking Water';
    if (tags.amenity === 'toilets') return 'Public Toilets';
    if (tags.amenity === 'cafe') return 'Cafe';
    if (tags.amenity === 'hotel') return 'Hotel';
    return 'Amenity';
}

/**
 * Displays POI list in UI with filters
 */
function displayPOIs(pois) {
    const poiContent = document.getElementById('poi-content');

    if (pois.length === 0) {
        poiContent.innerHTML = '<p class="no-stations">No notable places found</p>';
        return;
    }

    // Extract unique types for filters
    const types = [...new Set(pois.map(p => p.metadata).filter(m => m))];

    // Apply filters
    let filteredPOIs = pois;
    if (activePOIFilters.size > 0) {
        filteredPOIs = pois.filter(p => activePOIFilters.has(p.metadata));
    }

    const insidePOIs = filteredPOIs.filter(p => p.inside);
    const outsidePOIs = filteredPOIs.filter(p => !p.inside).slice(0, 10);

    let html = '';

    // Add filters if there are multiple types
    if (types.length > 1) {
        html += '<div class="filter-container">';
        types.sort().forEach(type => {
            const count = pois.filter(p => p.metadata === type).length;
            const active = activePOIFilters.size === 0 || activePOIFilters.has(type);
            html += `<button class="filter-btn ${active ? 'active' : ''}" data-filter="${type}" data-filter-type="poi">
                ${type} (${count})
            </button>`;
        });
        html += '</div>';
    }

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

    if (filteredPOIs.length === 0 && activePOIFilters.size > 0) {
        html += '<p class="no-stations">No places match selected filters</p>';
    }

    poiContent.innerHTML = html;

    // Add filter click listeners
    document.querySelectorAll('.filter-btn[data-filter-type="poi"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            if (activePOIFilters.has(filter)) {
                activePOIFilters.delete(filter);
            } else {
                activePOIFilters.add(filter);
            }
            displayPOIs(currentPOIs);
        });
    });

    // Add POI click listeners
    document.querySelectorAll('.poi-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectPOI(index);
        });
    });
}

/**
 * Displays amenity list in UI with filters
 */
function displayAmenities(amenities) {
    const amenitiesContent = document.getElementById('amenities-content');

    if (amenities.length === 0) {
        amenitiesContent.innerHTML = '<p class="no-stations">No amenities found</p>';
        return;
    }

    // Extract unique types for filters
    const types = [...new Set(amenities.map(a => a.metadata).filter(m => m))];

    // Apply filters
    let filteredAmenities = amenities;
    if (activeAmenityFilters.size > 0) {
        filteredAmenities = amenities.filter(a => activeAmenityFilters.has(a.metadata));
    }

    const insideAmenities = filteredAmenities.filter(a => a.inside);
    const outsideAmenities = filteredAmenities.filter(a => !a.inside).slice(0, 10);

    let html = '';

    // Add filters if there are multiple types
    if (types.length > 1) {
        html += '<div class="filter-container">';
        types.sort().forEach(type => {
            const count = amenities.filter(a => a.metadata === type).length;
            const active = activeAmenityFilters.size === 0 || activeAmenityFilters.has(type);
            html += `<button class="filter-btn ${active ? 'active' : ''}" data-filter="${type}" data-filter-type="amenity">
                ${type} (${count})
            </button>`;
        });
        html += '</div>';
    }

    if (insideAmenities.length > 0) {
        if (outsideAmenities.length > 0) {
            html += '<div class="station-group-header">In Square</div>';
        }
        html += insideAmenities.map((a, idx) => renderAmenityItem(a, amenities.indexOf(a))).join('');
    }

    if (outsideAmenities.length > 0) {
        if (insideAmenities.length > 0) {
            html += '<div class="station-group-header">Nearby</div>';
        }
        html += outsideAmenities.map((a, idx) => renderAmenityItem(a, amenities.indexOf(a))).join('');
    }

    if (filteredAmenities.length === 0 && activeAmenityFilters.size > 0) {
        html += '<p class="no-stations">No amenities match selected filters</p>';
    }

    amenitiesContent.innerHTML = html;

    // Add filter click listeners
    document.querySelectorAll('.filter-btn[data-filter-type="amenity"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            if (activeAmenityFilters.has(filter)) {
                activeAmenityFilters.delete(filter);
            } else {
                activeAmenityFilters.add(filter);
            }
            displayAmenities(currentAmenities);
        });
    });

    // Add amenity click listeners
    document.querySelectorAll('.amenity-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectAmenity(index);
        });
    });
}

/**
 * Renders a single POI item
 */
function renderPOIItem(poi, index) {
    const distanceText = poi.distance > 0 ? formatDistance(poi.distance) : '';

    return `
        <div class="poi-item station-item" data-index="${index}">
            ${getPOIIcon(poi.tags)}
            <div class="station-info">
                <div class="station-name">${poi.name}</div>
                ${poi.metadata ? `<div class="station-meta">${poi.metadata}</div>` : ''}
            </div>
            ${distanceText ? `<div class="station-distance">${distanceText}</div>` : ''}
        </div>
    `;
}

/**
 * Renders a single amenity item
 */
function renderAmenityItem(amenity, index) {
    const distanceText = amenity.distance > 0 ? formatDistance(amenity.distance) : '';

    return `
        <div class="amenity-item station-item" data-index="${index}">
            ${getAmenityIcon(amenity.tags)}
            <div class="station-info">
                <div class="station-name">${amenity.name}</div>
                ${amenity.metadata ? `<div class="station-meta">${amenity.metadata}</div>` : ''}
            </div>
            ${distanceText ? `<div class="station-distance">${distanceText}</div>` : ''}
        </div>
    `;
}

/**
 * Adds POI markers to map
 */
function addPOIMarkers(pois) {
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];

    pois.forEach((poi, index) => {
        const iconHtml = getPOIMarkerIcon(poi.tags);
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

/**
 * Adds amenity markers to map
 */
function addAmenityMarkers(amenities) {
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];

    amenities.forEach((amenity, index) => {
        const iconHtml = getAmenityMarkerIcon(amenity.tags);
        const icon = L.divIcon({
            html: iconHtml,
            className: 'amenity-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([amenity.lat, amenity.lon], { icon })
            .addTo(map)
            .on('click', () => selectAmenity(index));

        amenityMarkers.push(marker);
    });
}

/**
 * Selects a POI (highlights and centers map)
 */
function selectPOI(index) {
    selectedPOIIndex = index;
    const poi = currentPOIs[index];

    // Clear amenity selection
    selectedAmenityIndex = null;

    // Update UI selection
    document.querySelectorAll('.poi-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    document.querySelectorAll('.amenity-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Clear existing POI and amenity markers
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];

    // Create marker only for selected POI
    const iconHtml = getPOIMarkerIcon(poi.tags);
    const icon = L.divIcon({
        html: iconHtml,
        className: 'poi-marker marker-highlight',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([poi.lat, poi.lon], { icon }).addTo(map);
    poiMarkers.push(marker);

    // Center map on POI
    map.panTo([poi.lat, poi.lon]);

    // Expand sheet on mobile
    if (window.innerWidth < 768 && sheetState === 'peek') {
        setSheetState('full');
    }
}

/**
 * Selects an amenity (highlights and centers map)
 */
function selectAmenity(index) {
    selectedAmenityIndex = index;
    const amenity = currentAmenities[index];

    // Clear POI selection
    selectedPOIIndex = null;

    // Update UI selection
    document.querySelectorAll('.amenity-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    document.querySelectorAll('.poi-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Clear existing POI and amenity markers
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];

    // Create marker only for selected amenity
    const iconHtml = getAmenityMarkerIcon(amenity.tags);
    const icon = L.divIcon({
        html: iconHtml,
        className: 'amenity-marker marker-highlight',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const marker = L.marker([amenity.lat, amenity.lon], { icon }).addTo(map);
    amenityMarkers.push(marker);

    // Center map on amenity
    map.panTo([amenity.lat, amenity.lon]);

    // Expand sheet on mobile
    if (window.innerWidth < 768 && sheetState === 'peek') {
        setSheetState('full');
    }
}

/**
 * Highlights a marker by adding a pulsing effect
 * Used only for station markers now (POI/amenity markers are highlighted on creation)
 */
function highlightMarker(marker, type) {
    // Remove highlight from all markers
    stationMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });

    // Add highlight to selected marker
    if (marker) {
        const elem = marker.getElement();
        if (elem) elem.classList.add('marker-highlight');
    }
}

/**
 * Returns icon HTML for POI based on tags
 */
function getPOIIcon(tags) {
    let icon = 'place';
    let color = '#6b7280';

    // Determine icon and color based on tags
    if (tags.leisure === 'park' || tags.leisure === 'garden') {
        icon = 'park'; color = '#059669';
    } else if (tags.tourism === 'museum') {
        icon = 'museum'; color = '#8b5cf6';
    } else if (tags.historic === 'memorial' || tags.historic === 'monument') {
        icon = 'chess_rook'; color = '#6b7280';
    } else if (tags.amenity === 'library') {
        icon = 'local_library'; color = '#0891b2';
    } else if (tags.amenity === 'university') {
        icon = 'school'; color = '#0891b2';
    } else if (tags.amenity === 'theatre') {
        icon = 'theater_comedy'; color = '#ec4899';
    } else if (tags.amenity === 'cinema') {
        icon = 'local_movies'; color = '#dc2626';
    } else if (tags.tourism === 'attraction') {
        icon = 'attractions'; color = '#f59e0b';
    } else if (tags.tourism === 'viewpoint') {
        icon = 'visibility'; color = '#3b82f6';
    } else if (tags.natural === 'peak') {
        icon = 'terrain'; color = '#78716c';
    } else if (tags.natural === 'water' || tags.waterway) {
        icon = 'water'; color = '#0284c7';
    } else if (tags.aeroway) {
        icon = 'flight'; color = '#0284c7';
    } else if (tags.man_made === 'bridge' || tags.bridge) {
        icon = 'flyover'; color = '#6b7280';
    } else if (tags.building) {
        icon = 'domain'; color = '#6b7280';
    } else if (tags.historic) {
        icon = 'history_edu'; color = '#92400e';
    } else if (tags.leisure) {
        icon = 'sports_soccer'; color = '#059669';
    } else if (tags.tourism) {
        icon = 'tour'; color = '#f59e0b';
    }

    return `<span class="material-symbols-outlined station-icon" style="color: ${color};">${icon}</span>`;
}

/**
 * Returns icon HTML for amenities
 */
function getAmenityIcon(tags) {
    let icon = 'store';
    let color = '#6b7280';

    if (tags.amenity === 'drinking_water') {
        icon = 'water_drop'; color = '#0284c7';
    } else if (tags.amenity === 'cafe') {
        icon = 'local_cafe'; color = '#92400e';
    } else if (tags.amenity === 'hotel') {
        icon = 'hotel'; color = '#7c3aed';
    } else if (tags.amenity === 'toilets') {
        icon = 'wc'; color = '#0891b2';
    }

    return `<span class="material-symbols-outlined station-icon" style="color: ${color};">${icon}</span>`;
}

/**
 * Returns marker icon HTML for POI type
 */
function getPOIMarkerIcon(tags) {
    let color = '#6b7280';

    // Determine color based on tags
    if (tags.leisure) color = '#059669';
    else if (tags.tourism) color = '#f59e0b';
    else if (tags.historic) color = '#92400e';
    else if (tags.natural === 'water' || tags.waterway) color = '#0284c7';
    else if (tags.natural) color = '#78716c';
    else if (tags.aeroway) color = '#0284c7';
    else if (tags.building) color = '#6b7280';

    return `
        <div style="
            width: 18px;
            height: 18px;
            background: ${hexToRgba(color, 0.5)};
            border: 1px solid ${color};
            border-radius: 50%;
        "></div>
    `;
}

/**
 * Returns marker icon HTML for amenity type
 */
function getAmenityMarkerIcon(tags) {
    let color = '#6b7280';

    if (tags.amenity === 'drinking_water') {
        color = '#0284c7';
    } else if (tags.amenity === 'cafe') {
        color = '#92400e';
    } else if (tags.amenity === 'hotel') {
        color = '#7c3aed';
    } else if (tags.amenity === 'toilets') {
        color = '#0891b2';
    }

    return `
        <div style="
            width: 16px;
            height: 16px;
            background: ${hexToRgba(color, 0.5)};
            border: 1px solid ${color};
            border-radius: 50%;
        "></div>
    `;
}
