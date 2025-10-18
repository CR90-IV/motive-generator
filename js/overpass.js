// ========================================
// Overpass API Utilities
// ========================================

/**
 * Available Overpass API instances for load balancing and failover
 */
const OVERPASS_INSTANCES = [
    { url: 'https://overpass-api.de/api/interpreter', name: 'Germany' },
    { url: 'https://overpass.private.coffee/api/interpreter', name: 'Private Coffee' },
    { url: 'https://overpass.osm.jp/api/interpreter', name: 'Japan' }
];

let currentInstanceIndex = 0;

/**
 * Gets the next Overpass instance in rotation
 */
function getNextOverpassInstance() {
    currentInstanceIndex = (currentInstanceIndex + 1) % OVERPASS_INSTANCES.length;
    return OVERPASS_INSTANCES[currentInstanceIndex];
}

/**
 * Gets the current Overpass instance
 */
function getCurrentOverpassInstance() {
    return OVERPASS_INSTANCES[currentInstanceIndex];
}

/**
 * Fetches from Overpass API with retry logic for 504/429 errors
 * Rotates between instances on rate limiting
 */
async function fetchOverpassWithRetry(query, requestId, contentElement, retryCount = 0, instanceIndex = currentInstanceIndex) {
    const instance = OVERPASS_INSTANCES[instanceIndex];

    console.log(`[Overpass Query #${requestId}] Using ${instance.name} server (attempt ${retryCount + 1})`);

    const response = await fetch(instance.url, {
        method: 'POST',
        body: query
    });

    console.log(`[Overpass Query #${requestId}] Response status: ${response.status} ${response.statusText}`);

    // Handle rate limiting or timeout - try next instance
    if ((response.status === 504 || response.status === 429) && retryCount < OVERPASS_INSTANCES.length) {
        const delayMs = response.status === 429 ? 2000 : 1500;
        const delaySec = delayMs / 1000;
        const errorType = response.status === 429 ? 'Rate limited' : 'Server timeout';

        // Get next instance
        const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
        const nextInstance = OVERPASS_INSTANCES[nextInstanceIndex];

        console.log(`[Overpass Query #${requestId}] ${errorType} on ${instance.name}, rotating to ${nextInstance.name} in ${delaySec}s`);

        if (contentElement) {
            contentElement.innerHTML = `<p class="loading">${errorType}, switching to ${nextInstance.name} server<span class="loading-dots"></span></p>`;
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));

        if (contentElement) {
            contentElement.innerHTML = `<p class="loading">Retrying with ${nextInstance.name} server<span class="loading-dots"></span></p>`;
        }

        // Update global instance index for next query
        currentInstanceIndex = nextInstanceIndex;

        return fetchOverpassWithRetry(query, requestId, contentElement, retryCount + 1, nextInstanceIndex);
    }

    if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Calculates search bounds with buffer around a square
 */
function calculateSearchBounds(easting, northing, squareSize, bufferKm = 2) {
    const sw = osGridToLatLon(easting, northing);
    const ne = osGridToLatLon(easting + squareSize, northing + squareSize);

    const centerLat = (sw.lat + ne.lat) / 2;
    const latBuffer = bufferKm / 111.32;
    const lonBuffer = bufferKm / (111.32 * Math.cos(centerLat * Math.PI / 180));

    const south = Math.min(sw.lat, ne.lat) - latBuffer;
    const north = Math.max(sw.lat, ne.lat) + latBuffer;
    const west = Math.min(sw.lon, ne.lon) - lonBuffer;
    const east = Math.max(sw.lon, ne.lon) + lonBuffer;

    return { south, north, west, east, sw, ne };
}

/**
 * Fetches all data (stations, POIs, amenities) in a single Overpass query
 * @param {Object} contentElements - Optional content elements for loading messages
 */
async function fetchAllNearbyData(easting, northing, squareSize, requestId, contentElements = null) {
    const bounds = calculateSearchBounds(easting, northing, squareSize);
    const { south, north, west, east, sw, ne } = bounds;

    // Show initial loading message
    if (contentElements) {
        if (contentElements.stations) {
            contentElements.stations.innerHTML = '<p class="loading">Searching nearby stations<span class="loading-dots"></span></p>';
        }
        if (contentElements.pois) {
            contentElements.pois.innerHTML = '<p class="loading">Searching places<span class="loading-dots"></span></p>';
        }
        if (contentElements.amenities) {
            contentElements.amenities.innerHTML = '<p class="loading">Searching amenities<span class="loading-dots"></span></p>';
        }
    }

    // Combined query for all data types
    const query = `
        [out:json][timeout:30];
        (
            /* Stations */
            node["railway"="station"]["name"](${south},${west},${north},${east});
            node["railway"="halt"]["name"](${south},${west},${north},${east});

            /* POIs - Leisure (excluding fitness_centre, sports_centre, adult_gaming_centre) */
            node["leisure"]["name"]["leisure"!~"fitness_centre|sports_centre|adult_gaming_centre"](${south},${west},${north},${east});
            way["leisure"]["name"]["leisure"!~"fitness_centre|sports_centre|adult_gaming_centre"](${south},${west},${north},${east});
            rel["leisure"]["name"]["leisure"!~"fitness_centre|sports_centre|adult_gaming_centre"](${south},${west},${north},${east});

            /* POIs - Natural features */
            node["natural"="peak"]["name"](${south},${west},${north},${east});
            node["natural"="water"]["name"](${south},${west},${north},${east});
            way["natural"="water"]["name"](${south},${west},${north},${east});
            rel["natural"="water"]["name"](${south},${west},${north},${east});

            /* POIs - Waterways */
            node["waterway"]["name"](${south},${west},${north},${east});
            way["waterway"]["name"](${south},${west},${north},${east});
            rel["waterway"]["name"](${south},${west},${north},${east});

            /* POIs - Tourism (excluding hotels) */
            node["tourism"]["name"]["tourism"!="hotel"](${south},${west},${north},${east});
            way["tourism"]["name"]["tourism"!="hotel"](${south},${west},${north},${east});
            rel["tourism"]["name"]["tourism"!="hotel"](${south},${west},${north},${east});

            /* POIs - Historic */
            node["historic"]["name"](${south},${west},${north},${east});
            way["historic"]["name"](${south},${west},${north},${east});
            rel["historic"]["name"](${south},${west},${north},${east});

            /* POIs - Building amenities */
            node["amenity"~"library|university|arts_centre|community_centre|conference_centre|events_venue|exhibition_centre"]["name"](${south},${west},${north},${east});
            way["amenity"~"library|university|arts_centre|community_centre|conference_centre|events_venue|exhibition_centre"]["name"](${south},${west},${north},${east});
            rel["amenity"~"library|university|arts_centre|community_centre|conference_centre|events_venue|exhibition_centre"]["name"](${south},${west},${north},${east});

            /* POIs - Misc amenities */
            node["amenity"~"fountain|planetarium|public_bookcase|stage|townhall|marketplace|studio"]["name"](${south},${west},${north},${east});
            way["amenity"~"fountain|planetarium|public_bookcase|stage|townhall|marketplace|studio"]["name"](${south},${west},${north},${east});
            rel["amenity"~"fountain|planetarium|public_bookcase|stage|townhall|marketplace|studio"]["name"](${south},${west},${north},${east});

            /* POIs - Government offices */
            node["office"="government"]["name"](${south},${west},${north},${east});
            way["office"="government"]["name"](${south},${west},${north},${east});
            rel["office"="government"]["name"](${south},${west},${north},${east});

            /* POIs - Military */
            node["landuse"="military"]["name"](${south},${west},${north},${east});
            way["landuse"="military"]["name"](${south},${west},${north},${east});
            rel["landuse"="military"]["name"](${south},${west},${north},${east});
            node["military"]["name"](${south},${west},${north},${east});
            way["military"]["name"](${south},${west},${north},${east});
            rel["military"]["name"](${south},${west},${north},${east});

            /* POIs - Shops */
            node["shop"~"mall|department_store"]["name"](${south},${west},${north},${east});
            way["shop"~"mall|department_store"]["name"](${south},${west},${north},${east});
            rel["shop"~"mall|department_store"]["name"](${south},${west},${north},${east});

            /* POIs - Bridges */
            node["man_made"="bridge"]["name"](${south},${west},${north},${east});
            way["bridge"]["name"](${south},${west},${north},${east});
            rel["bridge"]["name"](${south},${west},${north},${east});

            /* POIs - Aerodromes */
            node["aeroway"~"aerodrome|airport"]["name"](${south},${west},${north},${east});
            way["aeroway"~"aerodrome|airport"]["name"](${south},${west},${north},${east});
            rel["aeroway"~"aerodrome|airport"]["name"](${south},${west},${north},${east});

            /* POIs - Railway crossings */
            node["railway"="level_crossing"](${south},${west},${north},${east});
            node["railway"="crossing"](${south},${west},${north},${east});

            /* Amenities */
            node["amenity"~"drinking_water|water_point"](${south},${west},${north},${east});
            node["amenity"="hotel"]["name"](${south},${west},${north},${east});
            way["amenity"="hotel"]["name"](${south},${west},${north},${east});
            rel["amenity"="hotel"]["name"](${south},${west},${north},${east});
            node["tourism"="hotel"]["name"](${south},${west},${north},${east});
            way["tourism"="hotel"]["name"](${south},${west},${north},${east});
            rel["tourism"="hotel"]["name"](${south},${west},${north},${east});
            node["amenity"="toilets"](${south},${west},${north},${east});
        );
        out geom;
    `;

    console.log(`[Overpass Query #${requestId}] Sending combined query`);
    // Use stations element for retry messages since it's a combined query
    const retryElement = contentElements?.stations || null;
    const data = await fetchOverpassWithRetry(query, requestId, retryElement);
    console.log(`[Overpass Query #${requestId}] Found ${data.elements?.length || 0} total elements`);

    // Categorize results
    const stations = [];
    const pois = [];
    const amenities = [];

    for (const element of data.elements) {
        const tags = element.tags || {};

        // Categorize based on tags
        if (tags.railway === 'station' || tags.railway === 'halt') {
            stations.push(element);
        } else if (tags.amenity === 'drinking_water' || tags.amenity === 'water_point' ||
                   tags.amenity === 'toilets' || tags.amenity === 'hotel' || tags.tourism === 'hotel') {
            amenities.push(element);
        } else {
            pois.push(element);
        }
    }

    console.log(`[Overpass Query #${requestId}] Categorized: ${stations.length} stations, ${pois.length} POIs, ${amenities.length} amenities`);

    return {
        stations,
        pois,
        amenities,
        bounds: { south, north, west, east, sw, ne }
    };
}

/**
 * Fetches nearby stations with wider fallback search if needed
 */
async function fetchStationsWithFallback(easting, northing, squareSize, initialStations, requestId) {
    if (initialStations.length > 0) {
        return initialStations;
    }

    console.log(`[Overpass Query #${requestId}] No stations found, searching wider area`);

    const center = osGridToLatLon(easting + squareSize / 2, northing + squareSize / 2);
    const widerQuery = `
        [out:json][timeout:25];
        (
            node["railway"="station"]["name"](around:10000,${center.lat},${center.lon});
            node["railway"="halt"]["name"](around:10000,${center.lat},${center.lon});
        );
        out body;
    `;

    const widerData = await fetchOverpassWithRetry(widerQuery, requestId, null);
    console.log(`[Overpass Query #${requestId}] Found ${widerData.elements?.length || 0} stations in wider search`);

    return widerData.elements.slice(0, 1); // Return only the closest station
}
