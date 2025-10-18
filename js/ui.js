// ========================================
// UI Interactions and State Management
// ========================================

// State
let currentEasting;
let currentNorthing;
let original1kmEasting;
let original1kmNorthing;
let currentViewMode = '1km';
let sheetState = 'hidden'; // 'hidden', 'peek', 'full'
let currentAreaId = 'greater-london'; // Current selected area region

/**
 * Initializes the bottom sheet / side panel
 */
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

/**
 * Sets the sheet state
 */
function setSheetState(state) {
    const sheet = document.getElementById('sheet');
    sheet.classList.remove('hidden', 'peek', 'full');
    sheet.classList.add(state);
    sheetState = state;
}

// ========================================
// Grid Reference Input
// ========================================

/**
 * Sets up the grid reference input field
 */
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
            updateURL(normalizedGridRef, currentAreaId);
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

/**
 * Updates URL with grid reference and area parameters
 */
function updateURL(gridRef, areaId) {
    const url = new URL(window.location.href);
    url.searchParams.set('grid', gridRef);

    // Only add area parameter if it's not the default
    if (areaId && areaId !== 'greater-london') {
        // For custom areas, extract just the OSM ID
        const osmIdMatch = areaId.match(/^custom-(\d+)$/);
        const urlAreaId = osmIdMatch ? osmIdMatch[1] : areaId;
        url.searchParams.set('area', urlAreaId);
    } else {
        url.searchParams.delete('area');
    }

    window.history.replaceState({}, '', url.toString());
    console.log(`[URL] Updated URL with grid=${gridRef}, area=${areaId || 'default'}`);
}

/**
 * Loads area and grid square from URL parameters
 */
async function loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const gridParam = urlParams.get('grid');
    const areaParam = urlParams.get('area');

    console.log(`[URL Load] Grid param: ${gridParam}, Area param: ${areaParam}`);

    // Load area first if specified
    if (areaParam) {
        // Check if it's a preset area
        if (AREA_REGIONS[areaParam]) {
            console.log(`[URL Load] Loading preset area: ${areaParam}`);
            selectArea(areaParam);
        } else {
            // Check if it's a numeric OSM ID (format: 123456 or custom-123456)
            const customMatch = areaParam.match(/^(?:custom-)?(\d+)$/);
            if (customMatch) {
                const relationId = parseInt(customMatch[1]);
                const customAreaId = `custom-${relationId}`;
                console.log(`[URL Load] Loading custom area from relation: ${relationId}`);

                // Show loading message
                showToast('Loading area from URL...');

                try {
                    // Fetch boundary and name from OSM
                    const boundary = await fetchOSMBoundary(relationId);

                    // Fetch the name from OSM tags
                    let areaName = `Area ${relationId}`;
                    try {
                        const nameQuery = `
                            [out:json][timeout:10];
                            relation(${relationId});
                            out tags;
                        `;
                        const instance = getCurrentOverpassInstance();
                        const nameResponse = await fetch(instance.url, {
                            method: 'POST',
                            body: nameQuery
                        });
                        const nameData = await nameResponse.json();
                        if (nameData.elements && nameData.elements[0] && nameData.elements[0].tags) {
                            areaName = nameData.elements[0].tags.name || areaName;
                        }
                    } catch (nameError) {
                        console.warn('[URL Load] Could not fetch area name:', nameError);
                    }

                    AREA_REGIONS[customAreaId] = {
                        name: areaName,
                        osmRelationId: relationId,
                        boundary: boundary,
                        type: 'polygon',
                        loading: false
                    };

                    // Add to dropdown
                    addCustomAreaToDropdown(customAreaId, areaName);

                    currentAreaId = customAreaId;
                    document.getElementById('area-name').textContent = areaName;

                    // Clear active state from preset buttons
                    document.querySelectorAll('.area-preset-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });

                    // Set active on custom button
                    const customBtn = document.querySelector(`.area-preset-btn[data-area="${customAreaId}"]`);
                    if (customBtn) {
                        customBtn.classList.add('active');
                    }

                    // Draw boundary
                    if (typeof drawAreaBoundary === 'function') {
                        drawAreaBoundary(boundary, 'polygon');
                    }

                    console.log(`[URL Load] Custom area loaded: ${areaName}`);
                } catch (error) {
                    console.error('[URL Load] Failed to load custom area:', error);
                    showToast('Failed to load area from URL');
                }
            }
        }
    }

    // Load grid square if specified
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

/**
 * Copies text to clipboard with fallback
 */
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

/**
 * Shows a toast notification
 */
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
// Area Selection
// ========================================

/**
 * Initializes area selection UI
 */
function initAreaSelection() {
    const areaPill = document.getElementById('area-pill');
    const areaDropdown = document.getElementById('area-dropdown');
    const presetButtons = document.querySelectorAll('.area-preset-btn');
    const searchInput = document.getElementById('area-search-input');

    // Area pill click - toggle dropdown
    areaPill.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAreaDropdown();
    });

    // Preset button clicks
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const areaId = btn.dataset.area;
            selectArea(areaId);
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!areaDropdown.contains(e.target) && !areaPill.contains(e.target)) {
            closeAreaDropdown();
        }
    });

    // Prevent dropdown clicks from closing it
    areaDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Search input handler (debounced)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            clearAreaSearchResults();
            return;
        }

        searchTimeout = setTimeout(() => {
            searchAreaBoundaries(query);
        }, 300);
    });
}

/**
 * Searches for area boundaries and displays results
 */
async function searchAreaBoundaries(query) {
    const resultsContainer = document.getElementById('area-search-results');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<div style="padding: 1rem; color: var(--color-text-secondary); font-size: 0.875rem;">Searching...</div>';

    try {
        const results = await searchOSMBoundaries(query);

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 1rem; color: var(--color-text-secondary); font-size: 0.875rem;">No results found</div>';
            return;
        }

        // Display results
        resultsContainer.innerHTML = '';
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'area-search-result-item';
            item.innerHTML = `
                <span class="material-symbols-outlined">location_on</span>
                <span class="area-search-result-name">${result.name}</span>
                <span class="area-search-result-type">${result.type}</span>
            `;

            item.addEventListener('click', () => {
                selectCustomArea(result);
            });

            resultsContainer.appendChild(item);
        });
    } catch (error) {
        console.error('[Area Search] Error:', error);
        resultsContainer.innerHTML = '<div style="padding: 1rem; color: var(--color-text-secondary); font-size: 0.875rem;">Search failed</div>';
    }
}

/**
 * Clears area search results
 */
function clearAreaSearchResults() {
    const resultsContainer = document.getElementById('area-search-results');
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
}

/**
 * Adds a custom area to the dropdown menu
 */
function addCustomAreaToDropdown(areaId, areaName) {
    // Check if it already exists
    if (document.querySelector(`.area-preset-btn[data-area="${areaId}"]`)) {
        console.log(`[Custom Area] Button for ${areaId} already exists`);
        return;
    }

    const presetsContainer = document.querySelector('.area-presets');

    // Create a separator if this is the first custom area
    if (!document.querySelector('.custom-areas-separator')) {
        const separator = document.createElement('div');
        separator.className = 'custom-areas-separator';
        separator.innerHTML = '<span>Recent Searches</span>';
        presetsContainer.appendChild(separator);
    }

    // Create the button
    const button = document.createElement('button');
    button.className = 'area-preset-btn custom-area-btn';
    button.setAttribute('data-area', areaId);
    button.innerHTML = `
        <span class="material-symbols-outlined">search</span>
        <span>${areaName}</span>
        <button class="remove-custom-area" data-area="${areaId}" title="Remove">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;

    // Add click handler
    button.addEventListener('click', (e) => {
        // Don't trigger if clicking the remove button
        if (e.target.closest('.remove-custom-area')) {
            return;
        }
        selectArea(areaId);
    });

    // Add remove button handler
    const removeBtn = button.querySelector('.remove-custom-area');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustomArea(areaId);
    });

    presetsContainer.appendChild(button);
    console.log(`[Custom Area] Added button for ${areaName}`);
}

/**
 * Removes a custom area from the dropdown and AREA_REGIONS
 */
function removeCustomArea(areaId) {
    console.log(`[Custom Area] Removing ${areaId}`);

    // Remove from AREA_REGIONS
    delete AREA_REGIONS[areaId];

    // Remove button from dropdown
    const button = document.querySelector(`.area-preset-btn[data-area="${areaId}"]`);
    if (button) {
        button.remove();
    }

    // Remove separator if no custom areas remain
    const customButtons = document.querySelectorAll('.custom-area-btn');
    if (customButtons.length === 0) {
        const separator = document.querySelector('.custom-areas-separator');
        if (separator) {
            separator.remove();
        }
    }

    // If this was the selected area, switch to Greater London
    if (currentAreaId === areaId) {
        selectArea('greater-london');
    }

    showToast('Custom area removed');
}

/**
 * Selects a custom area from search results
 */
async function selectCustomArea(result) {
    console.log(`[Custom Area] Loading ${result.name} (relation ${result.id})...`);

    // Show loading toast
    showToast(`Loading ${result.name}...`);

    try {
        // Fetch the boundary for this OSM relation
        console.log(`[Custom Area] Fetching boundary...`);
        const boundary = await fetchOSMBoundary(result.id);
        console.log(`[Custom Area] Received boundary with ${boundary.length} points`);

        // Create a custom area ID
        const customAreaId = `custom-${result.id}`;

        // Add to AREA_REGIONS
        AREA_REGIONS[customAreaId] = {
            name: result.name,
            osmRelationId: result.id,
            boundary: boundary,
            type: 'polygon',
            loading: false
        };

        console.log(`[Custom Area] Added to AREA_REGIONS as ${customAreaId}`);

        // Add button to dropdown if it doesn't exist
        addCustomAreaToDropdown(customAreaId, result.name);

        // Select this area
        currentAreaId = customAreaId;

        // Update UI
        document.getElementById('area-name').textContent = result.name;

        // Clear active state from preset buttons
        document.querySelectorAll('.area-preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Set active state on the custom button
        const customBtn = document.querySelector(`.area-preset-btn[data-area="${customAreaId}"]`);
        if (customBtn) {
            customBtn.classList.add('active');
        }

        // Clear search input and results
        document.getElementById('area-search-input').value = '';
        clearAreaSearchResults();

        // Draw area boundary on map
        if (typeof drawAreaBoundary === 'function') {
            drawAreaBoundary(boundary, 'polygon');
        }

        // Close dropdown
        closeAreaDropdown();

        // Show success toast
        console.log(`[Custom Area] Successfully loaded ${result.name}`);
        showToast(`Area: ${result.name}`);
    } catch (error) {
        console.error('[Custom Area] Error loading boundary:', error);
        showToast(`Failed to load ${result.name}. Try a different area or one of the presets.`);
    }
}

/**
 * Toggles the area dropdown open/closed
 */
function toggleAreaDropdown() {
    const areaDropdown = document.getElementById('area-dropdown');
    const areaPill = document.getElementById('area-pill');

    const isHidden = areaDropdown.classList.contains('hidden');

    if (isHidden) {
        areaDropdown.classList.remove('hidden');
        areaPill.classList.add('active');
    } else {
        areaDropdown.classList.add('hidden');
        areaPill.classList.remove('active');
    }
}

/**
 * Closes the area dropdown
 */
function closeAreaDropdown() {
    const areaDropdown = document.getElementById('area-dropdown');
    const areaPill = document.getElementById('area-pill');

    areaDropdown.classList.add('hidden');
    areaPill.classList.remove('active');
}

/**
 * Selects an area region and updates UI
 */
function selectArea(areaId) {
    console.log(`[Select Area] Selecting area: ${areaId}`);

    if (!AREA_REGIONS[areaId]) {
        console.error(`Unknown area: ${areaId}`);
        return;
    }

    currentAreaId = areaId;
    const areaConfig = AREA_REGIONS[areaId];
    const areaName = areaConfig.name;

    // Update header pill label
    document.getElementById('area-name').textContent = areaName;

    // Update active state on preset buttons
    document.querySelectorAll('.area-preset-btn').forEach(btn => {
        if (btn.dataset.area === areaId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Draw area boundary on map
    if (typeof drawAreaBoundary === 'function') {
        drawAreaBoundary(areaConfig.boundary, areaConfig.type);
    }

    // Close dropdown after selection
    closeAreaDropdown();

    // Show toast
    showToast(`Area: ${areaName}`);
}

// ========================================
// Event Listeners
// ========================================

/**
 * Randomize button click handler
 */
document.getElementById('randomize-btn').addEventListener('click', () => {
    console.log(`[Randomize] Button clicked`);
    console.log(`[Randomize] Current area ID:`, currentAreaId);
    console.log(`[Randomize] AREA_REGIONS:`, AREA_REGIONS);

    const areaConfig = AREA_REGIONS[currentAreaId];
    console.log(`[Randomize] Area config:`, areaConfig);

    const boundary = areaConfig.boundary;
    console.log(`[Randomize] Boundary type:`, areaConfig.type);
    console.log(`[Randomize] Boundary data:`, boundary);

    const { easting, northing } = getRandomSquare(boundary);
    console.log(`[Randomize] Generated square: E=${easting}, N=${northing}`);

    showSquare(easting, northing, 1000);
});

/**
 * 10km/1km toggle button click handler
 */
document.getElementById('view-10km-btn').addEventListener('click', () => {
    if (currentViewMode === '1km') {
        const easting10km = Math.floor(original1kmEasting / 10000) * 10000;
        const northing10km = Math.floor(original1kmNorthing / 10000) * 10000;
        showSquare(easting10km, northing10km, 10000);
    } else {
        showSquare(original1kmEasting, original1kmNorthing, 1000);
    }
});

/**
 * Share button click handler
 */
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
    initAreaSelection();
    setupGridRefInput();

    // Draw the default area boundary (Greater London)
    setTimeout(() => {
        if (AREA_REGIONS[currentAreaId]) {
            const areaConfig = AREA_REGIONS[currentAreaId];
            if (typeof drawAreaBoundary === 'function') {
                console.log(`[Init] Drawing default area boundary for ${areaConfig.name}`);
                drawAreaBoundary(areaConfig.boundary, areaConfig.type);
            }
        }
    }, 500); // Wait for map to initialize

    // Load from URL if present
    const loadedFromURL = loadFromURL();

    // If nothing loaded from URL, keep empty state visible
    if (!loadedFromURL) {
        // Empty state is visible by default
    }
});
