// ========================================
// Overpass API Utilities
// ========================================

/**
 * Fetches from Overpass API with retry logic for 504/429 errors
 */
async function fetchOverpassWithRetry(query, requestId, contentElement, retryCount = 0) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
    });

    console.log(`[Overpass Query #${requestId}] Response status: ${response.status} ${response.statusText}`);

    if ((response.status === 504 || response.status === 429) && retryCount === 0) {
        const delayMs = response.status === 429 ? 3000 : 2000;
        const delaySec = delayMs / 1000;
        const errorType = response.status === 429 ? 'Rate limited' : 'Server timeout';

        console.log(`[Overpass Query #${requestId}] ${errorType}, waiting ${delaySec}s before retry`);

        if (contentElement) {
            contentElement.innerHTML = `<p class="loading">${errorType}, retrying in ${delaySec}s<span class="loading-dots"></span></p>`;
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));

        if (contentElement) {
            contentElement.innerHTML = '<p class="loading">Retrying search<span class="loading-dots"></span></p>';
        }

        return fetchOverpassWithRetry(query, requestId, contentElement, retryCount + 1);
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
 */
async function fetchAllNearbyData(easting, northing, squareSize, requestId) {
    const bounds = calculateSearchBounds(easting, northing, squareSize);
    const { south, north, west, east, sw, ne } = bounds;

    // Combined query for all data types
    const query = `
        [out:json][timeout:30];
        (
            /* Stations */
            node["railway"="station"]["name"](${south},${west},${north},${east});
            node["railway"="halt"]["name"](${south},${west},${north},${east});

            /* POIs */
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

            /* Amenities */
            node["amenity"="drinking_water"](${south},${west},${north},${east});
            node["amenity"="hotel"]["name"](${south},${west},${north},${east});
            way["amenity"="hotel"]["name"](${south},${west},${north},${east});
            node["amenity"="toilets"](${south},${west},${north},${east});
        );
        out geom;
    `;

    console.log(`[Overpass Query #${requestId}] Sending combined query`);
    const data = await fetchOverpassWithRetry(query, requestId, null);
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
        } else if (tags.amenity === 'drinking_water' || tags.amenity === 'toilets' ||
                   (tags.amenity === 'hotel' && tags.name)) {
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
