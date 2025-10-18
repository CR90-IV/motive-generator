// ========================================
// Marker Creation and Management
// ========================================

/**
 * Creates marker icon HTML for stations
 */
function createStationMarkerIcon(type) {
    const config = getStationIconConfig(type);
    return `
        <div style="
            width: 32px;
            height: 32px;
            background: ${hexToRgba(config.color, 0.95)};
            border: 2px solid white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
            <span class="material-symbols-outlined" style="
                font-size: 20px;
                color: white;
                font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
            ">${config.icon}</span>
        </div>
    `;
}

/**
 * Creates marker icon HTML for POIs
 */
function createPOIMarkerIcon(tags) {
    const config = getPOIIconConfig(tags);
    return `
        <div style="
            width: 24px;
            height: 24px;
            background: ${hexToRgba(config.color, 0.75)};
            border: 1px solid white;
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
            ">${config.icon}</span>
        </div>
    `;
}

/**
 * Creates marker icon HTML for amenities
 */
function createAmenityMarkerIcon(tags) {
    const config = getAmenityIconConfig(tags);
    return `
        <div style="
            width: 15px;
            height: 15px;
            background: ${hexToRgba(config.color, 0.7)};
            border: 1px solid white;
            border-radius: 25%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">
            <span class="material-symbols-outlined" style="
                font-size: 12px;
                color: white;
                font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 12;
            ">${config.icon}</span>
        </div>
    `;
}

/**
 * Creates popup content for a marker
 */
function createMarkerPopup(item) {
    let popupContent = `<div class="marker-popup"><strong>${item.name}</strong>`;

    if (item.metadata || item.meta) {
        const metadata = item.metadata || item.meta;
        popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${metadata}</div>`;
    }

    if (item.type) {
        popupContent += `<div style="margin-top: 0.25rem; color: #6b7280; font-size: 0.875rem;">${item.type}</div>`;
    }

    if (item.distance > 0) {
        popupContent += `<div style="margin-top: 0.25rem; color: #9ca3af; font-size: 0.8125rem;">${formatDistance(item.distance)} from square</div>`;
    }

    // Add tags
    if (item.tags && Object.keys(item.tags).length > 0) {
        popupContent += `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af;">`;
        Object.entries(item.tags).forEach(([key, value]) => {
            popupContent += `<div><span style="color: #6b7280;">${key}:</span> ${value}</div>`;
        });
        popupContent += `</div>`;
    }

    popupContent += `<div style="margin-top: 0.5rem;"><a href="https://www.openstreetmap.org/${item.osmType}/${item.osmId}" target="_blank" rel="noopener" style="color: #3b82f6; font-size: 0.7rem; text-decoration: none;">OpenStreetMap →</a></div>`;
    popupContent += `</div>`;

    return popupContent;
}

/**
 * Creates a marker on the map
 */
function createMarker(item, iconHtml, className, iconSize, onClickCallback) {
    const icon = L.divIcon({
        html: iconHtml,
        className: className,
        iconSize: iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
    });

    const popupContent = createMarkerPopup(item);
    const marker = L.marker([item.lat, item.lon], { icon })
        .bindPopup(popupContent, {
            closeButton: true,
            offset: [0, -iconSize[1] / 2],
            autoPan: true,
            autoPanPadding: [50, 50],
            maxHeight: 300,
            maxWidth: 300
        })
        .addTo(map);

    if (onClickCallback) {
        marker.on('click', onClickCallback);
    }

    return marker;
}

/**
 * Clears all marker highlights
 */
function clearAllMarkerHighlights(markerArrays) {
    markerArrays.forEach(markers => {
        if (markers) {
            markers.forEach(m => {
                const elem = m.getElement();
                if (elem) elem.classList.remove('marker-highlight');
            });
        }
    });
}

/**
 * Highlights a specific marker
 */
function highlightMarker(marker) {
    if (marker) {
        const elem = marker.getElement();
        if (elem) elem.classList.add('marker-highlight');
    }
}

/**
 * Removes markers from map
 */
function removeMarkers(markers) {
    markers.forEach(marker => map.removeLayer(marker));
    markers.length = 0;
}
