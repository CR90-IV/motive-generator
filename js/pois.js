// ========================================
// POI and Amenities Search and Display
// ========================================

// State
let poiSearchRequestId = 0;
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
 * Searches for nearby points of interest and amenities
 */
async function findNearbyPOIs(easting, northing, squareSize, poisData = null, amenitiesData = null, bounds = null) {
    poiSearchRequestId++;
    const thisRequestId = poiSearchRequestId;
    console.log(`[POI Search #${thisRequestId}] Starting search for square at E${easting} N${northing}`);

    const poiContent = document.getElementById('poi-content');
    const amenitiesContent = document.getElementById('amenities-content');

    poiContent.innerHTML = '<p class="loading">Finding places<span class="loading-dots"></span></p>';
    amenitiesContent.innerHTML = '<p class="loading">Finding amenities<span class="loading-dots"></span></p>';

    // Clear existing markers and polygons
    clearCategoryData('poi');
    clearCategoryData('amenity');

    try {
        const squareCorners = getSquareCorners(easting, northing, squareSize);

        // Process POIs and amenities
        const pois = processPOIData(poisData || [], squareCorners);
        const amenities = processPOIData(amenitiesData || [], squareCorners);

        // Check if still latest request
        if (thisRequestId !== poiSearchRequestId) {
            console.log(`[POI Search #${thisRequestId}] Discarding results - newer request made`);
            return;
        }

        currentPOIs = pois;
        currentAmenities = amenities;
        activePOIFilters.clear();
        activeAmenityFilters.clear();

        displayCategory('poi', pois);
        displayCategory('amenity', amenities);
        addCategoryMarkers('poi', pois);
        addCategoryMarkers('amenity', amenities);

    } catch (error) {
        console.error(`[POI Search #${thisRequestId}] Error:`, error);

        if (thisRequestId !== poiSearchRequestId) {
            return;
        }

        poiContent.innerHTML = '<p class="no-stations">Error loading places</p>';
        amenitiesContent.innerHTML = '<p class="no-stations">Error loading amenities</p>';
    }
}

/**
 * Processes raw POI/amenity data into display format
 */
function processPOIData(elements, squareCorners) {
    return elements.map(element => {
        const coords = extractGeometry(element);
        if (!coords) return null;

        const { lat, lon, geometry } = coords;
        const { sw, ne, nw, se } = squareCorners;
        const distance = distanceToSquareEdge(lat, lon, sw, ne, nw, se);

        const name = element.tags.name || getDefaultName(element.tags) || 'Unnamed place';
        if (!element.tags.name && !getDefaultName(element.tags)) return null;

        return {
            name,
            metadata: extractMetadata(element.tags),
            tags: element.tags,
            distance,
            inside: distance === 0,
            lat,
            lon,
            geometry,
            osmType: element.type,
            osmId: element.id
        };
    })
    .filter(p => p !== null)
    .sort((a, b) => {
        if (a.inside && !b.inside) return -1;
        if (!a.inside && b.inside) return 1;
        if (a.inside && b.inside) {
            const typeA = a.metadata || '';
            const typeB = b.metadata || '';
            return typeA.localeCompare(typeB);
        }
        return a.distance - b.distance;
    });
}

/**
 * Clears category data (markers, polygons, state)
 */
function clearCategoryData(category) {
    const markers = category === 'poi' ? poiMarkers : amenityMarkers;
    const polygons = category === 'poi' ? poiPolygons : amenityPolygons;

    removeMarkers(markers);
    polygons.forEach(polygon => map.removeLayer(polygon));
    polygons.length = 0;

    if (category === 'poi') {
        currentPOIs = [];
        selectedPOIIndex = null;
    } else {
        currentAmenities = [];
        selectedAmenityIndex = null;
    }
}

/**
 * Displays POI or amenity list with filters
 */
function displayCategory(category, items) {
    const contentId = category === 'poi' ? 'poi-content' : 'amenities-content';
    const content = document.getElementById(contentId);
    const activeFilters = category === 'poi' ? activePOIFilters : activeAmenityFilters;
    const filtersCollapsed = category === 'poi' ? poiFiltersCollapsed : amenityFiltersCollapsed;

    if (items.length === 0) {
        content.innerHTML = `<p class="no-stations">No ${category === 'poi' ? 'notable places' : 'amenities'} found</p>`;
        return;
    }

    // Extract unique types for filters
    const types = [...new Set(items.map(i => i.metadata).filter(m => m))];

    // Apply filters
    let filteredItems = items;
    if (activeFilters.size > 0) {
        filteredItems = items.filter(i => activeFilters.has(i.metadata));
    }

    const insideItems = filteredItems.filter(i => i.inside);
    const outsideItems = filteredItems.filter(i => !i.inside).slice(0, 10);

    let html = '';

    // Add filters if there are multiple types
    if (types.length > 1) {
        html += '<div class="filter-section">';
        html += `<button class="filter-toggle" data-filter-type="${category}" aria-label="Toggle filters">
            <span class="filter-toggle-label">Filters</span>
            <span class="material-symbols-outlined">${filtersCollapsed ? 'expand_more' : 'expand_less'}</span>
        </button>`;
        html += `<div class="filter-container ${filtersCollapsed ? 'collapsed' : ''}">`;
        types.sort().forEach(type => {
            const count = items.filter(i => i.metadata === type).length;
            const active = activeFilters.size === 0 || activeFilters.has(type);
            html += `<button class="filter-btn ${active ? 'active' : ''}" data-filter="${type}" data-filter-type="${category}">
                ${type} (${count})
            </button>`;
        });
        html += '</div></div>';
    }

    // Render items
    if (insideItems.length > 0) {
        if (outsideItems.length > 0) html += '<div class="station-group-header">In Square</div>';
        html += insideItems.map((i, idx) => renderCategoryItem(category, i, items.indexOf(i))).join('');
    }

    if (outsideItems.length > 0) {
        if (insideItems.length > 0) html += '<div class="station-group-header">Nearby</div>';
        html += outsideItems.map((i, idx) => renderCategoryItem(category, i, items.indexOf(i))).join('');
    }

    if (filteredItems.length === 0 && activeFilters.size > 0) {
        html += `<p class="no-stations">No ${category === 'poi' ? 'places' : 'amenities'} match selected filters</p>`;
    }

    content.innerHTML = html;

    // Add event listeners
    attachCategoryListeners(category, items);
}

/**
 * Renders a single POI or amenity item
 */
function renderCategoryItem(category, item, index) {
    const distanceText = item.distance > 0 ? formatDistance(item.distance) : '';
    const className = category === 'poi' ? 'poi-item' : 'amenity-item';
    const iconFunc = category === 'poi' ? createPOIIcon : createAmenityIcon;

    return `
        <div class="${className} station-item" data-index="${index}">
            ${iconFunc(item.tags)}
            <div class="station-info">
                <div class="station-name">${item.name}</div>
                ${item.metadata ? `<div class="station-meta">${item.metadata}</div>` : ''}
            </div>
            ${distanceText ? `<div class="station-distance">${distanceText}</div>` : ''}
        </div>
    `;
}

/**
 * Attaches event listeners for category display
 */
function attachCategoryListeners(category, items) {
    // Filter toggle listener
    const filterToggle = document.querySelector(`.filter-toggle[data-filter-type="${category}"]`);
    if (filterToggle) {
        filterToggle.addEventListener('click', () => {
            if (category === 'poi') {
                poiFiltersCollapsed = !poiFiltersCollapsed;
                displayCategory('poi', currentPOIs);
            } else {
                amenityFiltersCollapsed = !amenityFiltersCollapsed;
                displayCategory('amenity', currentAmenities);
            }
        });
    }

    // Filter button listeners
    document.querySelectorAll(`.filter-btn[data-filter-type="${category}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            const activeFilters = category === 'poi' ? activePOIFilters : activeAmenityFilters;

            if (activeFilters.has(filter)) {
                activeFilters.delete(filter);
            } else {
                activeFilters.add(filter);
            }

            displayCategory(category, items);
            updateCategoryMapHighlighting(category);
        });
    });

    // Item click listeners
    const className = category === 'poi' ? '.poi-item' : '.amenity-item';
    document.querySelectorAll(className).forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            selectCategoryItem(category, index);
        });
    });
}

/**
 * Adds markers for POIs or amenities
 */
function addCategoryMarkers(category, items) {
    const markers = category === 'poi' ? poiMarkers : amenityMarkers;
    const iconFunc = category === 'poi' ? createPOIMarkerIcon : createAmenityMarkerIcon;
    const className = category === 'poi' ? 'poi-marker' : 'amenity-marker';
    const iconSize = category === 'poi' ? [24, 24] : [22, 22];

    removeMarkers(markers);

    items.forEach((item, index) => {
        const iconHtml = iconFunc(item.tags);
        const marker = createMarker(item, iconHtml, className, iconSize, () => selectCategoryItem(category, index));
        markers.push(marker);
    });
}

/**
 * Selects a POI or amenity
 */
function selectCategoryItem(category, index) {
    const items = category === 'poi' ? currentPOIs : currentAmenities;
    const item = items[index];

    console.log(`[${category.toUpperCase()} Selected]`, {
        name: item.name,
        metadata: item.metadata,
        tags: item.tags,
        distance: item.distance,
        inside: item.inside,
        lat: item.lat,
        lon: item.lon,
        geometry: item.geometry ? `${item.geometry.length} points` : 'none',
        osmType: item.osmType,
        osmId: item.osmId,
        osmUrl: `https://www.openstreetmap.org/${item.osmType}/${item.osmId}`
    });

    // Update selection state
    if (category === 'poi') {
        selectedPOIIndex = index;
        selectedAmenityIndex = null;
    } else {
        selectedAmenityIndex = index;
        selectedPOIIndex = null;
    }

    // Update UI selection
    const selectedClass = category === 'poi' ? '.poi-item' : '.amenity-item';
    const otherClass = category === 'poi' ? '.amenity-item, .station-item' : '.poi-item, .station-item';

    document.querySelectorAll(selectedClass).forEach((el, idx) => {
        el.classList.toggle('selected', idx === index);
    });
    document.querySelectorAll(otherClass).forEach(el => {
        el.classList.remove('selected');
    });

    // Clear all highlights and polygons
    clearAllMarkerHighlights([stationMarkers, poiMarkers, amenityMarkers]);
    clearPolygons();

    // Draw polygon if available
    if (item.geometry && item.geometry.length > 2) {
        const config = category === 'poi' ? getPOIIconConfig(item.tags) : getAmenityIconConfig(item.tags);
        const polygon = L.polygon(item.geometry, {
            color: config.color,
            fillColor: config.color,
            fillOpacity: 0.2,
            weight: 2,
            opacity: 0.7
        }).addTo(map);

        if (category === 'poi') {
            poiPolygons.push(polygon);
        } else {
            amenityPolygons.push(polygon);
        }
    }

    // Highlight selected marker
    const markers = category === 'poi' ? poiMarkers : amenityMarkers;
    highlightMarker(markers[index]);

    // Center map
    map.panTo([item.lat, item.lon]);

    // Collapse sheet on mobile
    if (window.innerWidth < 768 && sheetState === 'full') {
        setSheetState('peek');
    }
}

/**
 * Updates map highlighting based on active filters
 */
function updateCategoryMapHighlighting(category) {
    const items = category === 'poi' ? currentPOIs : currentAmenities;
    const markers = category === 'poi' ? poiMarkers : amenityMarkers;
    const polygons = category === 'poi' ? poiPolygons : amenityPolygons;
    const activeFilters = category === 'poi' ? activePOIFilters : activeAmenityFilters;
    const iconFunc = category === 'poi' ? createPOIMarkerIcon : createAmenityMarkerIcon;
    const className = category === 'poi' ? 'poi-marker' : 'amenity-marker';
    const iconSize = category === 'poi' ? [24, 24] : [22, 22];

    // Clear existing
    removeMarkers(markers);
    polygons.forEach(polygon => map.removeLayer(polygon));
    polygons.length = 0;

    // Determine which items to show
    let itemsToShow = items;
    if (activeFilters.size > 0) {
        itemsToShow = items.filter(i => activeFilters.has(i.metadata));
    }

    // Add markers for visible items
    itemsToShow.forEach((item, index) => {
        const iconHtml = iconFunc(item.tags);
        const originalIndex = items.indexOf(item);
        const marker = createMarker(item, iconHtml, className, iconSize, () => selectCategoryItem(category, originalIndex));
        markers.push(marker);
    });
}

/**
 * Clears all polygons
 */
function clearPolygons() {
    poiPolygons.forEach(polygon => map.removeLayer(polygon));
    poiPolygons.length = 0;
    amenityPolygons.forEach(polygon => map.removeLayer(polygon));
    amenityPolygons.length = 0;
}
