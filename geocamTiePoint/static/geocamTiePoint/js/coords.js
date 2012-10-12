// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var TILE_SIZE = 256;
var INITIAL_RESOLUTION = 2 * Math.PI * 6378137 / TILE_SIZE;
var ORIGIN_SHIFT = 2 * Math.PI * 6378137 / 2.0;
var MIN_ZOOM_OFFSET = 3;

var maxDimensionG = null;
var maxZoom0G = null;

function initializeCoords() {
    // initialize global variables whose value depends on the overlay parameters
    maxDimensionG = Math.max(overlay.imageSize[0], overlay.imageSize[1]);
    maxZoom0G = Math.ceil(Math.log(maxDimensionG / TILE_SIZE) / Math.log(2)) +
        MIN_ZOOM_OFFSET;
}

function latLonToMeters(latLon) {
    var mx = latLon.lng() * ORIGIN_SHIFT / 180;
    var my = Math.log(Math.tan((90 + latLon.lat()) * Math.PI / 360)) /
        (Math.PI / 180);
    my = my * ORIGIN_SHIFT / 180;
    return {x: mx,
            y: my};
}

function metersToLatLon(meters) {
    var lng = meters.x * 180 / ORIGIN_SHIFT;
    var lat = meters.y * 180 / ORIGIN_SHIFT;
    lat = ((Math.atan(Math.exp((lat * (Math.PI / 180)))) * 360) / Math.PI) - 90;
    var latLng = new google.maps.LatLng(lat, lng);
    return latLng;
}

function metersToPixels(meters) {
    var res = resolution(maxZoom0G);
    var px = (meters.x + ORIGIN_SHIFT) / res;
    var py = (-meters.y + ORIGIN_SHIFT) / res;
    return {x: px, y: py};
}

function pixelsToMeters(pixels, maxZoom) {
    maxZoom = maxZoom || maxZoom0G; // Use the global maxZoom if none is given.
    assert(typeof maxZoom !== 'undefined', 'maxZoom required');
    var res = resolution(maxZoom0G);
    var mx = (pixels.x * res) - ORIGIN_SHIFT;
    var my = -(pixels.y * res) + ORIGIN_SHIFT;
    return {x: mx, y: my};
}

function resolution(zoom) {
    return INITIAL_RESOLUTION / (Math.pow(2, zoom));
}

function latLonToPixel(latLon) {
    var meters = latLonToMeters(latLon);
    var pixels = metersToPixels(meters);
    return pixels;
}

function pixelsToLatLon(pixels, maxZoom) {
    var meters = pixelsToMeters(pixels, maxZoom);
    var latLon = metersToLatLon(meters);
    return latLon;
}

function getNormalizedCoord(coord, zoom) {
    var y = coord.y;
    var x = coord.x;
    var tileRange = 1 << zoom;

    if (y < 0 || y >= tileRange) {
        return null;
    }

    if (x < 0 || x >= tileRange) {
        x = (x % tileRange + tileRange) % tileRange;
    }

    return {x: x, y: y};
}

function forwardTransformLatLon(transform, latlon) {
    var pixelcoords = latLonToPixel(latlon);
    pixelcoords[0] = pixelcoords.x;
    pixelcoords[1] = pixelcoords.y;
    var transformedMeters = transform.forward(pixelcoords);
    transformedMeters.x = transformedMeters[0];
    transformedMeters.y = transformedMeters[1];
    return metersToLatLon(transformedMeters);
}
