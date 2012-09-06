// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var mapG;
var imageMapG;

var imageMarkersG = [];
var mapMarkersG = [];

var imageCoordsG = [];
var mapCoordsG = [];

var saveButtonTimeoutG = null;
var otherSaveButtonTimeoutG = null;
var warpButtonTimeoutG = null;
var otherWarpButtonTimeoutG = null;

var markerIconG = (
    new google.maps.MarkerImage
    ('http://maps.gstatic.com/mapfiles/markers2/marker_blank.png'));

var draggingG = false;
var previewOverlayG = null;

function getImageTileUrl(coord, zoom) {
    var normalizedCoord = getNormalizedCoord(coord, zoom);

    if (!normalizedCoord)
        return null;

    return fillTemplate(overlay.unalignedTilesUrl,
                        {zoom: zoom,
                         x: normalizedCoord.x,
                         y: normalizedCoord.y});
}

function initialize() {
    initializeCoords();
    initializeMap();
    initializeImage();
    initializeSearchBar();
    initializeDraggableOverlay();

    setState(overlay);
}

function initializeDraggableOverlay() {
    var imageUrl = '/overlay/' + overlay.key + '/image.png';
    var alignTransform = new Matrix(3, 3, overlay.transform.matrix);
    var opts = {}; // fill me in
    previewOverlayG =
        new geocamTiePoint.DraggableOverlay(imageUrl, alignTransform,
                                            opts);
    previewOverlayG.setMap(mapG);
}

function initializeSearchBar() {
    var input = document.getElementById('searchTextField');
    var autoComplete = new google.maps.places.Autocomplete(input);

    autoComplete.bindTo('bounds', mapG);

    var infoWindow = new google.maps.InfoWindow();
    var marker = new google.maps.Marker({
        map: mapG
    });

    google.maps.event.addListener(autoComplete, 'place_changed', function() {
        infoWindow.close();
        var place = autoComplete.getPlace();
        if (place.geometry.viewport) {
            mapG.fitBounds(place.geometry.viewport);
        } else {
            mapG.setCenter(place.geometry.location);
            mapG.setZoom(17);
        }

        var address = '';
        if (place.address_components) {
            address = [(place.address_components[0] &&
                        place.address_components[0].short_name || ''),
                       (place.address_components[1] &&
                        place.address_components[1].short_name || ''),
                       (place.address_components[2] &&
                        place.address_components[2].short_name || '')
                      ].join(' ');
        }

        infoWindow.setContent('<div><strong>' + place.name + '</strong><br>' +
                              address + '</div>');
        infoWindow.open(mapG, marker);
    });
}

function initializeMap() {
    var mapOptions = {
        zoom: 6,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    mapG = new google.maps.Map(document.getElementById('map_canvas'),
                               mapOptions);

    if (overlay.bounds) {
        fitNamedBounds(overlay.bounds, mapG);
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var pos = new google.maps.LatLng(position.coords.latitude,
                                             position.coords.longitude);
            mapG.setCenter(pos);
        }, function() {
            handleNoGeolocation(true);
        });
    } else {
        // browser doesn't support geolocation
        handleNoGeolocation(false);
    }

    google.maps.event.addListener(mapG, 'click', handleMapClick);
}

function getLabeledMarker(latLng, index, map,
                          dragEndHandler,
                          rightClickHandler) {
    var markerOpts = {
        title: '' + (index + 1),
        draggable: true,
        position: latLng,
        map: map,
        icon: markerIconG,
        labelContent: '' + (index + 1),
        labelAnchor: new google.maps.Point(20, 30),
        labelClass: 'labels',
        raiseOnDrag: false
    };
    var marker = new MarkerWithLabel(markerOpts);

    // add handlers
    google.maps.event.addListener(marker, 'dragstart', function(event) {
        draggingG = true;
    });
    google.maps.event.addListener(marker, 'dragend', function(i) {
        return function(event) {
            dragEndHandler(i, event);
            setTimeout(function() {draggingG = false;}, 100);
        }
    }(index));
    (google.maps.event.addListener
     (marker, 'rightclick', function(i) {
         return function(event) {
             rightClickHandler(i, event);
         }
     }(index)));

    return marker;
}

function getLabeledImageMarker(latLng, index) {
    return getLabeledMarker(latLng, index,
                            imageMapG,
                            handleImageMarkerDragEnd,
                            handleImageMarkerRightClick);
}

function getLabeledMapMarker(latLng, index) {
    return getLabeledMarker(latLng, index,
                            mapG,
                            handleMapMarkerDragEnd,
                            handleMapMarkerRightClick);
}

function initializeImage() {
    var mapOptions = {
        streetViewControl: false,
        backgroundColor: 'rgb(0,0,0)',
        mapTypeControlOptions: {
            mapTypeId: ['image-map']
        }
    };

    imageMapG = new google.maps.Map(document.getElementById('image_canvas'),
                                    mapOptions);

    // initialize viewport to contain image
    var w = overlay.imageSize[0];
    var h = overlay.imageSize[1];
    var sw = pixelsToLatLon({x: 0, y: h});
    var ne = pixelsToLatLon({x: w, y: 0});
    imageMapG.fitBounds(new google.maps.LatLngBounds(sw, ne));

    var maxZoom = (maxZoom0G +
               settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION);
    var imageMapTypeOptions = {
        getTileUrl: getImageTileUrl,
        tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
        maxZoom: maxZoom,
        minZoom: MIN_ZOOM_OFFSET,
        radius: 1738000,
        name: 'image-map'
    };
    var imageMapType = new google.maps.ImageMapType(imageMapTypeOptions);

    imageMapG.mapTypes.set('image-map', imageMapType);
    imageMapG.setMapTypeId('image-map');

    google.maps.event.addListener(imageMapG, 'click', handleImageClick);
}

function handleNoGeolocation(errorFlag) {
    fitNamedBounds(settings.GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT);
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

    return {
        x: x,
        y: y
    };
}

function handleImageClick(event) {
    if (draggingG) return;
    actionPerformed();
    var latLng = event.latLng;
    var coord = latLonToPixel(latLng);
    var index = imageMarkersG.length;

    var marker = getLabeledImageMarker(latLng, index);

    imageMarkersG.push(marker);
    imageCoordsG.push(coord);
}

function handleMapClick(event) {
    if (draggingG) return;
    actionPerformed();
    var latLng = event.latLng;
    var coord = latLonToMeters(latLng);
    var index = mapMarkersG.length;

    var marker = getLabeledMapMarker(latLng, index);

    mapMarkersG.push(marker);
    mapCoordsG.push(coord);
}

function handleImageMarkerDragEnd(markerIndex, event) {
    actionPerformed();
    var coords = latLonToPixel(event.latLng);
    imageCoordsG[markerIndex] = coords;

    updateAlignment();
}

function handleMapMarkerDragEnd(markerIndex, event) {
    actionPerformed();
    var coords = latLonToMeters(event.latLng);
    mapCoordsG[markerIndex] = coords;

    updateAlignment();
}

function handleImageMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    actionPerformed();
    imageCoordsG[markerIndex] = null;
    imageMarkersG[markerIndex].setMap(null);
    imageMarkersG[markerIndex] = null;
}

function handleMapMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    actionPerformed();
    mapCoordsG[markerIndex] = null;
    mapMarkersG[markerIndex].setMap(null);
    mapMarkersG[markerIndex] = null;
}

function warpButtonClicked(key) {
    if (warpButtonTimeoutG != null)
        clearTimeout(warpButtonTimeoutG);
    if (otherWarpButtonTimeoutG != null)
        clearTimeout(otherWarpButtonTimeoutG);
    var warpButton = $('#warp_button')[0];
    warpButton.disabled = true;
    warpButton.value = 'warping...';
    $.post(overlay.url.replace('.json', '/warp'))
        .success(function(data, status, khr) {
            warpButton.disabled = false;
            warpButton.value = 'success!';
            warpButtonTimeoutG = setTimeout(function() {
                warpButton.value = 'warp';
            }, 3000);
        })
        .error(function(xhr, status, error) {
            warpButton.disabled = false;
            warpButton.value = 'warp';
            alert('Error occurred during warping: ' + error);
        });
    otherWarpButtonTimeoutG = setTimeout(function() {
        if (warpButton.disabled) {
            warpButton.value = 'still warping...';
            warpButton.disabled = false;
        }
    }, 10000);
}

function updateAlignment() {
    if (imageCoordsG.length >= 2) {
        overlay = getState();

        overlay.transform = calculateAlignmentModel(overlay.points);
        previewOverlayG.alignTransform =
            new Matrix(3, 3, overlay.transform.matrix);
        previewOverlayG.draw();
    } else {
        overlay.transform = {
            'type': '',
            'matrix': []
        };
    }
}

function save(serverState) {
    // set the global 'overlay' variable to the latest sever state
    overlay = serverState;

    // getState() overwrites overlay.points and returns overlay. this
    // has the effect of merging the server state with the client-side
    // points
    var state = getState();

    /*
    // solve for the transform
    if (imageCoordsG.length) {
        state.transform = calculateAlignmentModel(state.points);
    } else {
        state.transform = {
            'type': '',
            'matrix': []
        };
    }*/

    var saveButton = $('#save_button')[0];
    $.post(overlay.url, JSON.stringify(state))
        .success(function(data, status, xhr) {
            saveButton.value = 'success!';
            saveButton.disabled = false;
            saveButtonTimeoutG = setTimeout(function() {
                saveButton.value = 'save';
            }, 3000);
        })
        .error(function(xhr, status, error) {
            saveButton.value = 'save';
            saveButton.disabled = false;
            alert('Error occurred while saving: ' + error);
        });
}

function saveButtonClicked() {
    if (saveButtonTimeoutG != null)
        clearTimeout(saveButtonTimeoutG);
    if (otherSaveButtonTimeoutG != null)
        clearTimeout(otherSaveButtonTimeoutG);

    saveButton = $('#save_button')[0];
    if (mapCoordsG.length != imageCoordsG.length) {
        var diff = mapCoordsG.length - imageCoordsG.length;
        if (diff > 0) // need to add points to image
            saveButton.value = 'Add ' + diff + ' to image';
        else
            saveButton.value = 'Add ' + (-diff) + ' to map';
        saveButtonTimeoutG = setTimeout(function() {
            saveButton.value = 'save';
        }, 3000);
        return;
    }

    saveButton.disabled = true;
    saveButton.value = 'saving...';
    $.getJSON(overlay.url)
        .success(save)
        .error(function(xhr, status, error) {
            saveButton.value = 'save';
            saveButton.disabled = false;
            alert('Error occurred while saving: ' + error);
        });
    otherSaveButtonTimeoutG = setTimeout(function() {
        if (saveButton.disabled) {
            saveButton.value = 'still saving...';
            saveButton.disabled = false;
        }
    }, 3000);
}

function resetButtonClicked() {
    actionPerformed();
    reset();
}

function reset() {
    $.each(imageMarkersG, function(i, marker) {
        if (marker.setMap) {
            marker.setMap(null);
        }
    });
    imageMarkersG = [];
    imageCoordsG = [];

    $.each(mapMarkersG, function(i, marker) {
        if (marker.setMap) {
            marker.setMap(null);
        }
    });
    mapMarkersG = [];
    mapCoordsG = [];
}

function getState() {
    var state = overlay;

    // state.name = $('#title')[0].value;

    var points = [];
    var n = Math.max(imageCoordsG.length, mapCoordsG.length);
    for (var i = 0; i < n; i++) {
        var coords = [];

        if (i < mapCoordsG.length) {
            coords[0] = mapCoordsG[i].x;
            coords[1] = mapCoordsG[i].y;
        } else {
            coords[0] = null;
            coords[1] = null;
        }

        if (i < imageCoordsG.length) {
            coords[2] = imageCoordsG[i].x;
            coords[3] = imageCoordsG[i].y;
        } else {
            coords[2] = null;
            coords[3] = null;
        }

        points.push(coords);
    }
    state.points = points;

    return state;
}

function setState(state) {
    reset(); // clear state

    if (state.points) {
        mapMarkersG = [];
        mapCoordsG = [];

        imageMarkersG = [];
        imageCoordsG = [];

        for (var index = 0; index < state.points.length; index++) {
            var point = state.points[index];

            var meters = {
                x: point[0],
                y: point[1]
            };
            if (meters.x != null && meters.y != null) {
                var latLng = metersToLatLon(meters);
                var marker = getLabeledMapMarker(latLng, index);
                mapMarkersG.push(marker);
                mapCoordsG.push(meters);
            }

            var pixels = {
                x: point[2],
                y: point[3]
            };
            if (pixels.x != null && pixels.y != null) {
                var latLng = pixelsToLatLon(pixels);
                var marker = getLabeledImageMarker(latLng, index);
                imageMarkersG.push(marker);
                imageCoordsG.push(pixels);
            }
        }
    }
}

function debugFit() {
    var U = getProjectiveUMatrixFromPoints(overlay.points);
    var T = new Matrix(3, 3, overlay.transform.matrix);
    var V = getVMatrixFromPoints(overlay.points);
    var Vapprox = applyTransform(overlay.transform, overlay.points);
    var Verror = Vapprox.subtract(V);
    console.log('U:\n' + U.toString());
    console.log('T:\n' + T.toString());
    console.log('V:\n' + V.toString());
    console.log('Vapprox:\n' + Vapprox.toString());
    console.log('Verror:\n' + Verror.toString());

    var greenIcon = (new google.maps.MarkerImage
                     ('http://maps.google.com/mapfiles/ms/icons/green.png'));
    var n = overlay.points.length;
    for (var i = 0; i < n; i++) {
        var meterCoords = {x: Vapprox.values[0][i], y: Vapprox.values[1][i]};
        console.log(meterCoords);
        var latlng = metersToLatLon(meterCoords);
        console.log(latlng);
        var markerOpts = {
            title: '' + (i + 1),
            draggable: true,
            position: latlng,
            map: mapG,
            icon: greenIcon,
            labelContent: '' + (i + 1),
            labelAnchor: new google.maps.Point(20, 30),
            labelClass: 'labels'
        };
        var marker = new MarkerWithLabel(markerOpts);
    }

}
