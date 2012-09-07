// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var tileSize = 256;
var offset = 3;
var opac = 0.6;
var OPACITY_MAX_PIXELS = 57;
var imageOverlay;

function getTransformedImageTileUrl(coord, zoom) {
    var normalizedCoord = getNormalizedCoord(coord, zoom);

    if (!normalizedCoord)
        return null;

    return fillTemplate(overlay.alignedTilesUrl,
                        {zoom: zoom,
                         x: normalizedCoord.x,
                         y: normalizedCoord.y});
}

var transformedImageMapTypeOptions = null;

var transformedImageMapType = null;

var map;

function initialize() {
    // find max zoom
    var maxZoom = 0; var offset = 3;
    if (overlay.imageSize[0] > overlay.imageSize[1]) {
        maxZoom = Math.ceil(Math.log(overlay.imageSize[0] / tileSize, 2)) +
            offset;
    } else {
        maxZoom = Math.ceil(Math.log(overlay.imageSize[1] / tileSize, 2)) +
            offset;
    }

    transformedImageMapTypeOptions = {
        getTileUrl: getTransformedImageTileUrl,
        tileSize: new google.maps.Size(tileSize, tileSize),
        maxZoom: maxZoom,
        minZoom: offset,
        radius: 1738000,
        opacity: parseFloat(opac),
        name: 'transformed-image-map'
    };

    transformedImageMapType = (new google.maps.ImageMapType
                               (transformedImageMapTypeOptions));

    var mapOptions = {
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById('map_canvas'),
                              mapOptions);
    fitNamedBounds(overlay.bounds);

    //insert the overlay map as first overlay map type at position 0
    map.overlayMapTypes.insertAt(0, transformedImageMapType);

    var initialOpacity = 60;
   // imageOverlay = new CustomTileOverlay(map,initialOpacity);
   // imageOverlay.show();

    createOpacityControl(map, initialOpacity);
}

function fitNamedBounds(b) {
    var bounds = (new google.maps.LatLngBounds
                  (new google.maps.LatLng(b.south, b.west),
                   new google.maps.LatLng(b.north, b.east)));
    map.fitBounds(bounds);
}

//set up a transparency slider
function createOpacityControl(map, opacity) {
    var sliderImageUrl = settings.STATIC_URL +
        'geocamTiePoint/images/opacity-slider3d6.png';

    // Create main div to hold the control.
    var opacityDiv = document.createElement('DIV');
    (opacityDiv.setAttribute
     ('style',
      'margin: 5px;' +
      ' overflow-x: hidden;' +
      ' overflow-y: hidden;' +
      ' background: url(' + sliderImageUrl + ') no-repeat;' +
      ' width: 71px;' +
      ' height: 21px;' +
      ' cursor: pointer;'));

    // Create knob
    var opacityKnobDiv = document.createElement('DIV');
    (opacityKnobDiv.setAttribute
     ('style',
      'padding: 0;' +
      ' margin: 0;' +
      ' overflow-x: hidden;' +
      ' overflow-y: hidden;' +
      ' background: url(' + sliderImageUrl + ') no-repeat -71px 0;' +
      ' width: 14px;' +
      ' height: 21px;'));
    opacityDiv.appendChild(opacityKnobDiv);

    var opacityCtrlKnob = new ExtDraggableObject(opacityKnobDiv, {
                            restrictY: true,
                            container: opacityDiv
    });

    google.maps.event.addListener(opacityCtrlKnob, 'dragend', function() {
            setOpacity(opacityCtrlKnob.valueX());
    });

    google.maps.event.addDomListener(opacityDiv, 'click', function(e) {
        var left = findPosLeft(this);
        var x = e.pageX - left - 5;
        opacityCtrlKnob.setValueX(x);
        setOpacity(x);
    });

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(opacityDiv);
    var initialValue = OPACITY_MAX_PIXELS / (100 / opacity);
    opacityCtrlKnob.setValueX(initialValue);
    setOpacity(initialValue);
}

function setOpacity(pixelX) {
    // pixelX in range 0 to OPACITY_MAX_PIXELS
    var opacityPercent = (100 / OPACITY_MAX_PIXELS) * pixelX;

    if (opacityPercent < 0) opacityPercent = 0;
    if (opacityPercent > 100) opacityPercent = 100;

    //console.log("opacity: " + opacityPercent);
    transformedImageMapType.setOpacity(opacityPercent / 100.0);
}

function findPosLeft(obj) {
    var curleft = 0;
    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
        } while (obj = obj.offsetParent);
        return curleft;
    }
    return undefined;
}

