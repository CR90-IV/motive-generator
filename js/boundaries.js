// ========================================
// OSM Boundary Fetching and Management
// ========================================

/**
 * Fetches an OSM boundary polygon by relation ID
 * @param {number} relationId - OSM relation ID
 * @returns {Promise<Array>} - Array of [easting, northing] coordinates
 */
async function fetchOSMBoundary(relationId) {
    console.log(`[Boundary Fetch] Starting fetch for relation ${relationId}`);

    // Use longer timeout for large boundaries
    const query = `
        [out:json][timeout:60];
        relation(${relationId});
        out geom;
    `;

    console.log(`[Boundary Fetch] Query:`, query);

    try {
        console.log(`[Boundary Fetch] Fetching from Overpass API with retry logic...`);

        // Use the retry wrapper from overpass.js to handle 504/429 errors
        const data = await fetchOverpassWithRetry(query, Date.now());
        console.log(`[Boundary Fetch] Received data:`, data);

        if (!data.elements || data.elements.length === 0) {
            console.error(`[Boundary Fetch] No elements in response`);
            throw new Error(`No boundary found for relation ${relationId}`);
        }

        const relation = data.elements[0];
        console.log(`[Boundary Fetch] Relation has ${relation.members?.length || 0} members`);

        // Extract ALL outer boundaries from the relation (multipolygons can have multiple)
        const outerWays = relation.members.filter(m => m.role === 'outer' && m.geometry);
        console.log(`[Boundary Fetch] Found ${outerWays.length} outer ways`);

        if (outerWays.length === 0) {
            console.error(`[Boundary Fetch] No outer ways with geometry found`);
            console.log(`[Boundary Fetch] Relation structure:`, JSON.stringify(relation, null, 2));
            throw new Error(`No outer boundary found for relation ${relationId}`);
        }

        // Order and combine outer way geometries to form a proper boundary
        // This prevents criss-crossing lines in complex multipolygons
        let allPoints = [];

        if (outerWays.length === 1) {
            // Simple case: single way
            allPoints = outerWays[0].geometry;
            console.log(`[Boundary Fetch] Single outer way with ${allPoints.length} points`);
        } else {
            // Complex case: multiple ways that need to be ordered
            console.log(`[Boundary Fetch] Ordering ${outerWays.length} outer ways...`);

            // Convert to lat/lon arrays for the shared orderWays function
            const ways = outerWays.map(way =>
                way.geometry.map(node => [node.lat, node.lon])
            );

            // Order the ways using shared function from geometry.js
            const orderedWays = orderWays(ways);

            // Flatten into single array
            orderedWays.forEach((way, index) => {
                console.log(`[Boundary Fetch] Outer way ${index + 1} has ${way.length} points`);
                allPoints = allPoints.concat(way.map(p => ({ lat: p[0], lon: p[1] })));
            });

            console.log(`[Boundary Fetch] Total points from all outer ways: ${allPoints.length}`);
        }

        // Convert lat/lon coordinates to OSGB36 easting/northing
        const boundary = allPoints.map(point => {
            const coords = latLonToOSGrid(point.lat, point.lon);
            return [Math.round(coords.easting), Math.round(coords.northing)];
        });

        // Remove duplicate consecutive points
        const uniqueBoundary = [];
        for (let i = 0; i < boundary.length; i++) {
            if (i === 0 || boundary[i][0] !== boundary[i-1][0] || boundary[i][1] !== boundary[i-1][1]) {
                uniqueBoundary.push(boundary[i]);
            }
        }

        console.log(`[Boundary Fetch] Converted to ${uniqueBoundary.length} unique OSGB36 points`);
        console.log(`[Boundary Fetch] Sample points (first 5):`, uniqueBoundary.slice(0, 5));
        console.log(`[Boundary Fetch] Bounds - E: ${Math.min(...uniqueBoundary.map(p => p[0]))} to ${Math.max(...uniqueBoundary.map(p => p[0]))}, N: ${Math.min(...uniqueBoundary.map(p => p[1]))} to ${Math.max(...uniqueBoundary.map(p => p[1]))}`);

        return uniqueBoundary;
    } catch (error) {
        console.error(`[Boundary Fetch] Error fetching relation ${relationId}:`, error);
        throw error;
    }
}

/**
 * Searches for OSM boundaries by name (admin boundaries)
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Array of search results
 */
async function searchOSMBoundaries(searchTerm) {
    console.log(`[Boundary Search] Searching for: "${searchTerm}"`);

    if (!searchTerm || searchTerm.length < 2) {
        console.log(`[Boundary Search] Search term too short`);
        return [];
    }

    // Search for administrative boundaries with the given name
    const query = `
        [out:json][timeout:10];
        (
            relation["boundary"="administrative"]["name"~"${searchTerm}",i];
        );
        out tags;
    `;

    console.log(`[Boundary Search] Query:`, query);

    try {
        const instance = getCurrentOverpassInstance();
        console.log(`[Boundary Search] Fetching from Overpass API (${instance.name})...`);
        const response = await fetch(instance.url, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`
        });

        console.log(`[Boundary Search] Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Boundary Search] Found ${data.elements?.length || 0} results`);

        // Format results
        const results = data.elements.map(element => {
            const adminLevel = element.tags.admin_level || 'Unknown';
            const name = element.tags.name || 'Unnamed';
            const type = getAdminLevelName(adminLevel);

            return {
                id: element.id,
                name: name,
                type: type,
                adminLevel: adminLevel,
                tags: element.tags
            };
        });

        // Sort by admin level (lower = higher priority)
        results.sort((a, b) => parseInt(a.adminLevel) - parseInt(b.adminLevel));

        const topResults = results.slice(0, 10);
        console.log(`[Boundary Search] Returning ${topResults.length} results:`, topResults.map(r => `${r.name} (${r.type})`));

        return topResults;
    } catch (error) {
        console.error('[Boundary Search] Error:', error);
        return [];
    }
}

/**
 * Gets human-readable name for OSM admin_level
 * @param {string} adminLevel - OSM admin_level value
 * @returns {string} - Human-readable name
 */
function getAdminLevelName(adminLevel) {
    const levels = {
        '2': 'Country',
        '3': 'Region',
        '4': 'State/Province',
        '5': 'County',
        '6': 'District',
        '7': 'Municipality',
        '8': 'City',
        '9': 'Suburb',
        '10': 'Neighborhood'
    };

    return levels[adminLevel] || `Level ${adminLevel}`;
}
