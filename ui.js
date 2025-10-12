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
let centralOnlyMode = false; // Toggle for central London only

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

/**
 * Updates URL with grid reference parameter
 */
function updateURL(gridRef) {
    const url = new URL(window.location.href);
    url.searchParams.set('grid', gridRef);
    window.history.replaceState({}, '', url.toString());
}

/**
 * Loads grid square from URL parameter
 */
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
// Event Listeners
// ========================================

/**
 * Central London toggle button click handler
 */
document.getElementById('central-toggle').addEventListener('click', () => {
    centralOnlyMode = !centralOnlyMode;
    const toggleBtn = document.getElementById('central-toggle');

    if (centralOnlyMode) {
        toggleBtn.classList.add('active');
    } else {
        toggleBtn.classList.remove('active');
    }

    showToast(centralOnlyMode ? 'Central London only' : 'All London');
});

/**
 * Randomize button click handler
 */
document.getElementById('randomize-btn').addEventListener('click', () => {
    const bounds = centralOnlyMode ? CENTRAL_LONDON_BOUNDS : LONDON_BOUNDS;
    const { easting, northing } = getRandomSquare(bounds);
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
    setupGridRefInput();

    // Load from URL if present
    const loadedFromURL = loadFromURL();

    // If nothing loaded from URL, keep empty state visible
    if (!loadedFromURL) {
        // Empty state is visible by default
    }
});
