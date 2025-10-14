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
let poiPolygons = [];
let amenityPolygons = [];
let selectedPOIIndex = null;
let selectedAmenityIndex = null;
let activePOIFilters = new Set();
let activeAmenityFilters = new Set();
let poiFiltersCollapsed = false;
let amenityFiltersCollapsed = false;

/**
 * Searches for nearby points of interest
 */
async function findNearbyPOIs(easting, northing, squareSize) {
    poiSearchRequestId++;
    const thisRequestId = poiSearchRequestId;
    console.log(`[POI Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const poiContent = document.getElementById('poi-content');
    poiContent.innerHTML = '<p class="loading">Finding places<span class="loading-dots"></span></p>';

    // Clear existing POI markers and polygons
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
    poiPolygons.forEach(polygon => map.removeLayer(polygon));
    poiPolygons = [];
    currentPOIs = [];
    selectedPOIIndex = null;

    try {
        const sw = osGridToLatLon(easting, northing);
        const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
        const nw = osGridToLatLon(easting, northing + squareSize);
        const se = osGridToLatLon(easting + squareSize, northing);

        // Calculate 2km buffer properly accounting for lat/lon difference
        const centerLat = (sw.lat + ne.lat) / 2;
        const bufferKm = 2; // 2km buffer
        const latBuffer = bufferKm / 111.32; // ~0.018 degrees
        const lonBuffer = bufferKm / (111.32 * Math.cos(centerLat * Math.PI / 180)); // Adjust for latitude

        const south = Math.min(sw.lat, ne.lat) - latBuffer;
        const north = Math.max(sw.lat, ne.lat) + latBuffer;
        const west = Math.min(sw.lon, ne.lon) - lonBuffer;
        const east = Math.max(sw.lon, ne.lon) + lonBuffer;

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
                node["railway"="level_crossing"](${south},${west},${north},${east});
                node["railway"="crossing"](${south},${west},${north},${east});
            );
            out geom;
        `;

        console.log(`[POI Search #${thisRequestId}] Sending Overpass query`);
        const data = await fetchOverpassWithRetry(query, thisRequestId, poiContent);
        console.log(`[POI Search #${thisRequestId}] Found ${data.elements?.length || 0} POIs`);

        const pois = data.elements.map(poi => {
            // Extract geometry if available (for ways/relations)
            let geometry = null;
            if (poi.type === 'way' && poi.geometry) {
                geometry = poi.geometry.map(node => [node.lat, node.lon]);
            }

            // Get center point
            let lat, lon;
            if (poi.lat && poi.lon) {
                // Node - has direct lat/lon
                lat = poi.lat;
                lon = poi.lon;
            } else if (geometry && geometry.length > 0) {
                // Way - calculate center from geometry
                const lats = geometry.map(p => p[0]);
                const lons = geometry.map(p => p[1]);
                lat = lats.reduce((a, b) => a + b) / lats.length;
                lon = lons.reduce((a, b) => a + b) / lons.length;
            } else {
                // No valid coordinates
                return null;
            }

            const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);
            const insideSquare = distance === 0;

            // Extract metadata from tags
            const metadata = extractPOIMetadata(poi.tags);

            // Get name or default name for railway crossings
            let name = poi.tags.name;
            if (!name && poi.tags.railway === 'level_crossing') {
                name = 'Railway Level Crossing';
            } else if (!name && poi.tags.railway === 'crossing') {
                name = 'Railway Crossing';
            } else if (!name) {
                name = 'Unnamed place';
            }

            return {
                name: name,
                metadata: metadata,
                tags: poi.tags,
                distance: distance,
                inside: insideSquare,
                lat: lat,
                lon: lon,
                geometry: geometry,
                osmType: poi.type,
                osmId: poi.id
            };
        }).filter(p => p !== null && p.name !== 'Unnamed place')
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
        addPOIMarkers(pois);

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

    // Clear existing amenity markers and polygons
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];
    amenityPolygons.forEach(polygon => map.removeLayer(polygon));
    amenityPolygons = [];
    currentAmenities = [];
    selectedAmenityIndex = null;

    try {
        const sw = osGridToLatLon(easting, northing);
        const ne = osGridToLatLon(easting + squareSize, northing + squareSize);
        const nw = osGridToLatLon(easting, northing + squareSize);
        const se = osGridToLatLon(easting + squareSize, northing);

        // Calculate 2km buffer properly accounting for lat/lon difference
        const centerLat = (sw.lat + ne.lat) / 2;
        const bufferKm = 2; // 2km buffer
        const latBuffer = bufferKm / 111.32; // ~0.018 degrees
        const lonBuffer = bufferKm / (111.32 * Math.cos(centerLat * Math.PI / 180)); // Adjust for latitude

        const south = Math.min(sw.lat, ne.lat) - latBuffer;
        const north = Math.max(sw.lat, ne.lat) + latBuffer;
        const west = Math.min(sw.lon, ne.lon) - lonBuffer;
        const east = Math.max(sw.lon, ne.lon) + lonBuffer;

        // Query for specific amenities
        const query = `
            [out:json][timeout:25];
            (
                node["amenity"="drinking_water"](${south},${west},${north},${east});
                node["amenity"="hotel"]["name"](${south},${west},${north},${east});
                way["amenity"="hotel"]["name"](${south},${west},${north},${east});
                node["amenity"="toilets"](${south},${west},${north},${east});
            );
            out geom;
        `;

        console.log(`[Amenity Search #${thisRequestId}] Sending Overpass query`);
        const data = await fetchOverpassWithRetry(query, thisRequestId, amenitiesContent);
        console.log(`[Amenity Search #${thisRequestId}] Found ${data.elements?.length || 0} amenities`);

        const amenities = data.elements.map(amenity => {
            // Extract geometry if available (for ways/relations)
            let geometry = null;
            if (amenity.type === 'way' && amenity.geometry) {
                geometry = amenity.geometry.map(node => [node.lat, node.lon]);
            }

            // Get center point
            let lat, lon;
            if (amenity.lat && amenity.lon) {
                // Node - has direct lat/lon
                lat = amenity.lat;
                lon = amenity.lon;
            } else if (geometry && geometry.length > 0) {
                // Way - calculate center from geometry
                const lats = geometry.map(p => p[0]);
                const lons = geometry.map(p => p[1]);
                lat = lats.reduce((a, b) => a + b) / lats.length;
                lon = lons.reduce((a, b) => a + b) / lons.length;
            } else {
                // No valid coordinates
                return null;
            }

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
                lon: lon,
                geometry: geometry,
                osmType: amenity.type,
                osmId: amenity.id
            };
        }).filter(a => a !== null)
          .sort((a, b) => {
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
        addAmenityMarkers(amenities);

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
    if (tags.railway) metadata.push(formatTagValue('railway', tags.railway));
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
        html += '<div class="filter-section">';
        html += `<button class="filter-toggle" data-filter-type="poi" aria-label="Toggle filters">
            <span class="filter-toggle-label">Filters</span>
            <span class="material-symbols-outlined">${poiFiltersCollapsed ? 'expand_more' : 'expand_less'}</span>
        </button>`;
        html += `<div class="filter-container ${poiFiltersCollapsed ? 'collapsed' : ''}">`;
        types.sort().forEach(type => {
            const count = pois.filter(p => p.metadata === type).length;
            const active = activePOIFilters.size === 0 || activePOIFilters.has(type);
            html += `<button class="filter-btn ${active ? 'active' : ''}" data-filter="${type}" data-filter-type="poi">
                ${type} (${count})
            </button>`;
        });
        html += '</div>';
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

    // Add filter toggle listener
    const poiFilterToggle = document.querySelector('.filter-toggle[data-filter-type="poi"]');
    if (poiFilterToggle) {
        poiFilterToggle.addEventListener('click', () => {
            poiFiltersCollapsed = !poiFiltersCollapsed;
            displayPOIs(currentPOIs);
        });
    }

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
            updatePOIMapHighlighting();
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
        html += '<div class="filter-section">';
        html += `<button class="filter-toggle" data-filter-type="amenity" aria-label="Toggle filters">
            <span class="filter-toggle-label">Filters</span>
            <span class="material-symbols-outlined">${amenityFiltersCollapsed ? 'expand_more' : 'expand_less'}</span>
        </button>`;
        html += `<div class="filter-container ${amenityFiltersCollapsed ? 'collapsed' : ''}">`;
        types.sort().forEach(type => {
            const count = amenities.filter(a => a.metadata === type).length;
            const active = activeAmenityFilters.size === 0 || activeAmenityFilters.has(type);
            html += `<button class="filter-btn ${active ? 'active' : ''}" data-filter="${type}" data-filter-type="amenity">
                ${type} (${count})
            </button>`;
        });
        html += '</div>';
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

    // Add filter toggle listener
    const amenityFilterToggle = document.querySelector('.filter-toggle[data-filter-type="amenity"]');
    if (amenityFilterToggle) {
        amenityFilterToggle.addEventListener('click', () => {
            amenityFiltersCollapsed = !amenityFiltersCollapsed;
            displayAmenities(currentAmenities);
        });
    }

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
            updateAmenityMapHighlighting();
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

        // Create popup content
        let popupContent = `<div class="marker-popup"><strong>${poi.name}</strong>`;
        if (poi.metadata) {
            popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${poi.metadata}</div>`;
        }
        if (poi.distance > 0) {
            popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(poi.distance)} from square</div>`;
        }

        // Add tags
        if (poi.tags && Object.keys(poi.tags).length > 0) {
            popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
            Object.entries(poi.tags).forEach(([key, value]) => {
                popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
            });
            popupContent += `</div>`;
        }

        popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
        popupContent += `</div>`;

        const marker = L.marker([poi.lat, poi.lon], { icon })
            .bindPopup(popupContent, { closeButton: true, offset: [0, -12] })
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
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        // Create popup content
        let popupContent = `<div class="marker-popup"><strong>${amenity.name}</strong>`;
        if (amenity.metadata) {
            popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${amenity.metadata}</div>`;
        }
        if (amenity.distance > 0) {
            popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(amenity.distance)} from square</div>`;
        }

        // Add tags
        if (amenity.tags && Object.keys(amenity.tags).length > 0) {
            popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
            Object.entries(amenity.tags).forEach(([key, value]) => {
                popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
            });
            popupContent += `</div>`;
        }

        popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${amenity.osmType}/${amenity.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
        popupContent += `</div>`;

        const marker = L.marker([amenity.lat, amenity.lon], { icon })
            .bindPopup(popupContent, { closeButton: true, offset: [0, -11] })
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

    // Log all POI information
    console.log('[POI Selected]', {
        name: poi.name,
        metadata: poi.metadata,
        tags: poi.tags,
        distance: poi.distance,
        inside: poi.inside,
        lat: poi.lat,
        lon: poi.lon,
        geometry: poi.geometry ? `${poi.geometry.length} points` : 'none',
        osmType: poi.osmType,
        osmId: poi.osmId,
        osmUrl: `https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}`
    });

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
    document.querySelectorAll('.amenity-item, .station-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Remove all marker highlights
    poiMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });
    amenityMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });
    if (typeof stationMarkers !== 'undefined') {
        stationMarkers.forEach(m => {
            const elem = m.getElement();
            if (elem) elem.classList.remove('marker-highlight');
        });
    }

    // Clear all polygons
    poiPolygons.forEach(polygon => map.removeLayer(polygon));
    poiPolygons = [];
    amenityPolygons.forEach(polygon => map.removeLayer(polygon));
    amenityPolygons = [];

    // Draw polygon for selected POI if available
    if (poi.geometry && poi.geometry.length > 2) {
        const color = getPOIColor(poi.tags);
        const polygon = L.polygon(poi.geometry, {
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2,
            opacity: 0.7
        }).addTo(map);
        poiPolygons.push(polygon);
    }

    // Highlight selected POI marker
    const selectedMarker = poiMarkers[index];
    if (selectedMarker) {
        const elem = selectedMarker.getElement();
        if (elem) elem.classList.add('marker-highlight');
    }

    // Center map on POI
    map.panTo([poi.lat, poi.lon]);

    // Collapse sheet on mobile to show map
    if (window.innerWidth < 768 && sheetState === 'full') {
        setSheetState('peek');
    }
}

/**
 * Selects an amenity (highlights and centers map)
 */
function selectAmenity(index) {
    selectedAmenityIndex = index;
    const amenity = currentAmenities[index];

    // Log all amenity information
    console.log('[Amenity Selected]', {
        name: amenity.name,
        metadata: amenity.metadata,
        tags: amenity.tags,
        distance: amenity.distance,
        inside: amenity.inside,
        lat: amenity.lat,
        lon: amenity.lon,
        geometry: amenity.geometry ? `${amenity.geometry.length} points` : 'none',
        osmType: amenity.osmType,
        osmId: amenity.osmId,
        osmUrl: `https://www.openstreetmap.org/${amenity.osmType}/${amenity.osmId}`
    });

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
    document.querySelectorAll('.poi-item, .station-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Remove all marker highlights
    amenityMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });
    poiMarkers.forEach(m => {
        const elem = m.getElement();
        if (elem) elem.classList.remove('marker-highlight');
    });
    if (typeof stationMarkers !== 'undefined') {
        stationMarkers.forEach(m => {
            const elem = m.getElement();
            if (elem) elem.classList.remove('marker-highlight');
        });
    }

    // Clear all polygons
    poiPolygons.forEach(polygon => map.removeLayer(polygon));
    poiPolygons = [];
    amenityPolygons.forEach(polygon => map.removeLayer(polygon));
    amenityPolygons = [];

    // Draw polygon for selected amenity if available
    if (amenity.geometry && amenity.geometry.length > 2) {
        const color = getAmenityColor(amenity.tags);
        const polygon = L.polygon(amenity.geometry, {
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2,
            opacity: 0.7
        }).addTo(map);
        amenityPolygons.push(polygon);
    }

    // Highlight selected amenity marker
    const selectedMarker = amenityMarkers[index];
    if (selectedMarker) {
        const elem = selectedMarker.getElement();
        if (elem) elem.classList.add('marker-highlight');
    }

    // Center map on amenity
    map.panTo([amenity.lat, amenity.lon]);

    // Collapse sheet on mobile to show map
    if (window.innerWidth < 768 && sheetState === 'full') {
        setSheetState('peek');
    }
}

/**
 * Updates POI markers on map based on active filters
 */
function updatePOIMapHighlighting() {
    // Clear existing POI markers and polygons
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
    poiPolygons.forEach(polygon => map.removeLayer(polygon));
    poiPolygons = [];

    // Determine which POIs to show
    let poisToShow = currentPOIs;
    let highlightClass = '';

    if (activePOIFilters.size > 0) {
        poisToShow = currentPOIs.filter(p => activePOIFilters.has(p.metadata));
        highlightClass = 'poi-filter-highlight';
    }

    // Add markers for visible POIs
    poisToShow.forEach((poi, index) => {
        const iconHtml = getPOIMarkerIcon(poi.tags);
        const icon = L.divIcon({
            html: iconHtml,
            className: `poi-marker ${highlightClass}`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        // Create popup content
        let popupContent = `<div class="marker-popup"><strong>${poi.name}</strong>`;
        if (poi.metadata) {
            popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${poi.metadata}</div>`;
        }
        if (poi.distance > 0) {
            popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(poi.distance)} from square</div>`;
        }

        // Add tags
        if (poi.tags && Object.keys(poi.tags).length > 0) {
            popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
            Object.entries(poi.tags).forEach(([key, value]) => {
                popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
            });
            popupContent += `</div>`;
        }

        popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
        popupContent += `</div>`;

        const originalIndex = currentPOIs.indexOf(poi);
        const marker = L.marker([poi.lat, poi.lon], { icon })
            .bindPopup(popupContent, { closeButton: true, offset: [0, -12] })
            .addTo(map)
            .on('click', () => selectPOI(originalIndex));

        poiMarkers.push(marker);
    });
}

/**
 * Updates amenity markers on map based on active filters
 */
function updateAmenityMapHighlighting() {
    // Clear existing amenity markers and polygons
    amenityMarkers.forEach(marker => map.removeLayer(marker));
    amenityMarkers = [];
    amenityPolygons.forEach(polygon => map.removeLayer(polygon));
    amenityPolygons = [];

    // Determine which amenities to show
    let amenitiesToShow = currentAmenities;
    let highlightClass = '';

    if (activeAmenityFilters.size > 0) {
        amenitiesToShow = currentAmenities.filter(a => activeAmenityFilters.has(a.metadata));
        highlightClass = 'amenity-filter-highlight';
    }

    // Add markers for visible amenities
    amenitiesToShow.forEach((amenity, index) => {
        const iconHtml = getAmenityMarkerIcon(amenity.tags);
        const icon = L.divIcon({
            html: iconHtml,
            className: `amenity-marker ${highlightClass}`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        // Create popup content
        let popupContent = `<div class="marker-popup"><strong>${amenity.name}</strong>`;
        if (amenity.metadata) {
            popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${amenity.metadata}</div>`;
        }
        if (amenity.distance > 0) {
            popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(amenity.distance)} from square</div>`;
        }

        // Add tags
        if (amenity.tags && Object.keys(amenity.tags).length > 0) {
            popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
            Object.entries(amenity.tags).forEach(([key, value]) => {
                popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
            });
            popupContent += `</div>`;
        }

        popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${amenity.osmType}/${amenity.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
        popupContent += `</div>`;

        const originalIndex = currentAmenities.indexOf(amenity);
        const marker = L.marker([amenity.lat, amenity.lon], { icon })
            .bindPopup(popupContent, { closeButton: true, offset: [0, -11] })
            .addTo(map)
            .on('click', () => selectAmenity(originalIndex));

        amenityMarkers.push(marker);
    });
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
 * Returns color for POI based on tags
 */
function getPOIColor(tags) {
    if (tags.leisure === 'park' || tags.leisure === 'garden') return '#059669';
    if (tags.tourism === 'museum') return '#8b5cf6';
    if (tags.historic === 'memorial' || tags.historic === 'monument') return '#6b7280';
    if (tags.amenity === 'library') return '#0891b2';
    if (tags.amenity === 'university') return '#0891b2';
    if (tags.amenity === 'theatre') return '#ec4899';
    if (tags.amenity === 'cinema') return '#dc2626';
    if (tags.tourism === 'attraction') return '#f59e0b';
    if (tags.tourism === 'viewpoint') return '#3b82f6';
    if (tags.natural === 'peak') return '#78716c';
    if (tags.natural === 'water' || tags.waterway) return '#0284c7';
    if (tags.railway === 'level_crossing' || tags.railway === 'crossing') return '#6b7280';
    if (tags.aeroway) return '#0284c7';
    if (tags.man_made === 'bridge' || tags.bridge) return '#6b7280';
    if (tags.building) return '#6b7280';
    if (tags.historic) return '#92400e';
    if (tags.leisure) return '#059669';
    if (tags.tourism) return '#f59e0b';
    return '#6b7280';
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
        icon = 'military_tech'; color = '#6b7280';
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
    } else if (tags.railway === 'level_crossing' || tags.railway === 'crossing') {
        icon = 'directions_walk'; color = '#6b7280';
    } else if (tags.aeroway) {
        icon = 'flight'; color = '#0284c7';
    } else if (tags.man_made === 'bridge' || tags.bridge) {
        icon = 'pergola'; color = '#6b7280';
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
 * Returns color for amenity based on tags
 */
function getAmenityColor(tags) {
    if (tags.amenity === 'drinking_water') return '#0284c7';
    if (tags.amenity === 'cafe') return '#92400e';
    if (tags.amenity === 'hotel') return '#7c3aed';
    if (tags.amenity === 'toilets') return '#0891b2';
    return '#6b7280';
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
    let icon = 'place';
    let color = '#6b7280';

    // Determine icon and color based on tags (same as listing)
    if (tags.leisure === 'park' || tags.leisure === 'garden') {
        icon = 'park'; color = '#059669';
    } else if (tags.tourism === 'museum') {
        icon = 'museum'; color = '#8b5cf6';
    } else if (tags.historic === 'memorial' || tags.historic === 'monument') {
        icon = 'military_tech'; color = '#6b7280';
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
    } else if (tags.railway === 'level_crossing' || tags.railway === 'crossing') {
        icon = 'directions_walk'; color = '#6b7280';
    } else if (tags.aeroway) {
        icon = 'flight'; color = '#0284c7';
    } else if (tags.man_made === 'bridge' || tags.bridge) {
        icon = 'pergola'; color = '#6b7280';
    } else if (tags.building) {
        icon = 'domain'; color = '#6b7280';
    } else if (tags.historic) {
        icon = 'history_edu'; color = '#92400e';
    } else if (tags.leisure) {
        icon = 'sports_soccer'; color = '#059669';
    } else if (tags.tourism) {
        icon = 'tour'; color = '#f59e0b';
    }

    return `
        <div style="
            width: 24px;
            height: 24px;
            background: ${hexToRgba(color, 0.75)};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">
            <span class="material-symbols-outlined" style="
                font-size: 15px;
                color: white;
                font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
            ">${icon}</span>
        </div>
    `;
}

/**
 * Returns marker icon HTML for amenity type
 */
function getAmenityMarkerIcon(tags) {
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

    return `
        <div style="
            width: 22px;
            height: 22px;
            background: ${hexToRgba(color, 0.7)};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">
            <span class="material-symbols-outlined" style="
                font-size: 14px;
                color: white;
                font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
            ">${icon}</span>
        </div>
    `;
}
