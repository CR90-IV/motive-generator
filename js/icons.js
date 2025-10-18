// ========================================
// Icon and Color Configuration
// ========================================

// Station type configuration
const STATION_CONFIG = {
    'Underground': { icon: 'subway', color: '#dc2626' },
    'Train': { icon: 'train', color: '#3b82f6' },
    'Light Rail': { icon: 'tram', color: '#059669' }
};

// POI type configuration (in priority order)
const POI_CONFIG = [
    { check: (t) => t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'nature_reserve', icon: 'park', color: '#059669' },
    { check: (t) => t.tourism === 'museum', icon: 'museum', color: '#8b5cf6' },
    { check: (t) => t.historic === 'memorial' || t.historic === 'monument', icon: 'military_tech', color: '#6b7280' },
    { check: (t) => t.amenity === 'library', icon: 'local_library', color: '#0891b2' },
    { check: (t) => t.amenity === 'university', icon: 'school', color: '#0891b2' },
    { check: (t) => t.amenity === 'planetarium', icon: 'public', color: '#8b5cf6' },
    { check: (t) => t.amenity === 'theatre', icon: 'theater_comedy', color: '#ec4899' },
    { check: (t) => t.amenity === 'cinema', icon: 'local_movies', color: '#dc2626' },
    { check: (t) => t.amenity === 'arts_centre', icon: 'palette', color: '#ec4899' },
    { check: (t) => t.amenity === 'community_centre', icon: 'groups', color: '#0891b2' },
    { check: (t) => t.amenity === 'conference_centre', icon: 'meeting_room', color: '#6b7280' },
    { check: (t) => t.amenity === 'events_venue', icon: 'celebration', color: '#f59e0b' },
    { check: (t) => t.amenity === 'exhibition_centre', icon: 'museum', color: '#8b5cf6' },
    { check: (t) => t.amenity === 'fountain', icon: 'sprinkler', color: '#0284c7' },
    { check: (t) => t.amenity === 'public_bookcase', icon: 'book', color: '#0891b2' },
    { check: (t) => t.amenity === 'stage', icon: 'podium', color: '#ec4899' },
    { check: (t) => t.amenity === 'townhall', icon: 'account_balance', color: '#6b7280' },
    { check: (t) => t.amenity === 'marketplace', icon: 'storefront', color: '#f59e0b' },
    { check: (t) => t.shop === 'mall' || t.shop === 'department_store', icon: 'local_mall', color: '#ec4899' },
    { check: (t) => t.tourism === 'attraction', icon: 'attractions', color: '#f59e0b' },
    { check: (t) => t.tourism === 'viewpoint', icon: 'visibility', color: '#3b82f6' },
    { check: (t) => t.natural === 'peak', icon: 'terrain', color: '#78716c' },
    { check: (t) => t.natural === 'water' || t.waterway, icon: 'water', color: '#0284c7' },
    { check: (t) => t.railway === 'level_crossing' || t.railway === 'crossing', icon: 'directions_walk', color: '#6b7280' },
    { check: (t) => t.aeroway, icon: 'flight', color: '#0284c7' },
    { check: (t) => t.man_made === 'bridge' || t.bridge, icon: 'pergola', color: '#6b7280' },
    { check: (t) => t.building, icon: 'domain', color: '#6b7280' },
    { check: (t) => t.historic, icon: 'history_edu', color: '#92400e' },
    { check: (t) => t.leisure, icon: 'sports_soccer', color: '#059669' },
    { check: (t) => t.shop, icon: 'shopping_bag', color: '#f59e0b' },
    { check: (t) => t.tourism, icon: 'tour', color: '#f59e0b' }
];

// Amenity type configuration
const AMENITY_CONFIG = {
    'drinking_water': { icon: 'water_drop', color: '#0284c7' },
    'water_point': { icon: 'water_drop', color: '#0284c7' },
    'cafe': { icon: 'local_cafe', color: '#92400e' },
    'hotel': { icon: 'hotel', color: '#6b7280' },
    'toilets': { icon: 'wc', color: '#0891b2' }
};

/**
 * Gets station type from OSM tags
 */
function getStationType(tags) {
    if (tags.station === 'subway') return 'Underground';
    if (tags.station === 'light_rail') return 'Light Rail';
    if (tags.usage === 'main' || tags.railway === 'halt') return 'Train';
    return 'Train';
}

/**
 * Gets icon and color for a station type
 */
function getStationIconConfig(type) {
    return STATION_CONFIG[type] || STATION_CONFIG['Train'];
}

/**
 * Gets icon and color for POI based on tags
 */
function getPOIIconConfig(tags) {
    for (const config of POI_CONFIG) {
        if (config.check(tags)) {
            return { icon: config.icon, color: config.color };
        }
    }
    return { icon: 'place', color: '#6b7280' };
}

/**
 * Gets icon and color for amenity based on tags
 */
function getAmenityIconConfig(tags) {
    // Check tourism=hotel first
    if (tags.tourism === 'hotel') {
        return AMENITY_CONFIG['hotel'];
    }
    const amenityType = tags.amenity;
    return AMENITY_CONFIG[amenityType] || { icon: 'store', color: '#6b7280' };
}

/**
 * Creates HTML for station icon (for list)
 */
function createStationIcon(type) {
    const config = getStationIconConfig(type);
    return `<span class="material-symbols-outlined station-icon" style="color: ${config.color};">${config.icon}</span>`;
}

/**
 * Creates HTML for POI icon (for list)
 */
function createPOIIcon(tags) {
    const config = getPOIIconConfig(tags);
    return `<span class="material-symbols-outlined station-icon" style="color: ${config.color};">${config.icon}</span>`;
}

/**
 * Creates HTML for amenity icon (for list)
 */
function createAmenityIcon(tags) {
    const config = getAmenityIconConfig(tags);
    return `<span class="material-symbols-outlined station-icon" style="color: ${config.color};">${config.icon}</span>`;
}

/**
 * Formats tag values for display (converts underscores, capitalizes)
 */
function formatTagValue(key, value) {
    return value.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Extracts display metadata from OSM tags
 */
function extractMetadata(tags) {
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
 * Gets default name for elements without names
 */
function getDefaultName(tags) {
    if (tags.railway === 'level_crossing') return 'Railway Level Crossing';
    if (tags.railway === 'crossing') return 'Railway Crossing';
    if (tags.amenity === 'drinking_water') return 'Drinking Water';
    if (tags.amenity === 'water_point') return 'Water Point';
    if (tags.amenity === 'toilets') return 'Public Toilets';
    if (tags.amenity === 'fountain') return 'Fountain';
    if (tags.amenity === 'public_bookcase') return 'Public Bookcase';
    if (tags.amenity === 'cafe') return 'Cafe';
    if (tags.amenity === 'hotel' || tags.tourism === 'hotel') return 'Hotel';
    return null;
}

/**
 * Extracts station metadata for display
 */
function extractStationMetadata(tags) {
    const line = tags.line || tags['line:name'] || null;
    const network = tags.network || null;
    const operator = tags.operator || null;

    // Priority: line > network > operator (if National Rail)
    if (line) {
        return formatLineName(line);
    } else if (operator && network === 'National Rail') {
        return operator;
    } else if (network) {
        return network;
    }

    return null;
}
