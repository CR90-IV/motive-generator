// ========================================
// Utility Functions
// ========================================

/**
 * Converts hex color to rgba
 */
function hexToRgba(hex, alpha = 1) {
    const m = hex.replace('#','');
    const bigint = parseInt(m.length === 3
        ? m.split('').map(c => c+c).join('')
        : m, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calculates distance between two lat/lon points using Haversine formula
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Calculates distance from point to nearest edge of square (0 if inside)
 */
function distanceToSquareEdge(pointLat, pointLon, sw, ne, nw, se) {
    const inside = pointLat >= Math.min(sw.lat, ne.lat) &&
                   pointLat <= Math.max(sw.lat, ne.lat) &&
                   pointLon >= Math.min(sw.lon, ne.lon) &&
                   pointLon <= Math.max(sw.lon, ne.lon);

    if (inside) return 0;

    const distances = [
        distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, se.lat, se.lon),
        distanceToLineSegment(pointLat, pointLon, nw.lat, nw.lon, ne.lat, ne.lon),
        distanceToLineSegment(pointLat, pointLon, sw.lat, sw.lon, nw.lat, nw.lon),
        distanceToLineSegment(pointLat, pointLon, se.lat, se.lon, ne.lat, ne.lon)
    ];

    return Math.min(...distances);
}

/**
 * Calculates perpendicular distance from point to line segment
 */
function distanceToLineSegment(pointLat, pointLon, lat1, lon1, lat2, lon2) {
    const px = pointLon;
    const py = pointLat;
    const x1 = lon1;
    const y1 = lat1;
    const x2 = lon2;
    const y2 = lat2;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    return calculateDistance(pointLat, pointLon, yy, xx);
}

/**
 * Formats distance for display
 */
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}

/**
 * Formats semicolon-separated line names (e.g., "metropolitan;piccadilly" → "Metropolitan, Piccadilly")
 */
function formatLineName(line) {
    if (!line) return null;

    const lines = line.split(';')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => {
            return l.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        });

    return lines.join(', ');
}
