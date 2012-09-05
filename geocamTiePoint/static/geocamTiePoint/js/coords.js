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

function metersToPixels(meters) {
    var res = resolution(maxZoom0G);
    var px = (meters.x + ORIGIN_SHIFT) / res;
    var py = (-meters.y + ORIGIN_SHIFT) / res;
    return {x: px, y: py};
}

function pixelsToMeters(pixels) {
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

function pixelsToLatLon(pixels) {
    var meters = pixelsToMeters(pixels);
    var latLon = metersToLatLon(meters);
    return latLon;
}
