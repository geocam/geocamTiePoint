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

var mapG;
var imageMapG;

var imageMarkersG = new Array();
var mapMarkersG = new Array();

var imageCoords = new Array();
var mapCoordsG = new Array();

var saveButtonTimeoutG = null;
var otherSaveButtonTimeoutG = null;
var warpButtonTimeoutG = null;
var otherWarpButtonTimeoutG = null;

var markerIconG = (
    new google.maps.MarkerImage
    ('http://maps.gstatic.com/mapfiles/markers2/marker_blank.png'));

var draggingG = false;

var undoStackG = new Array();
var redoStackG = new Array();

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
    maxDimensionG = Math.max(overlay.imageSize[0], overlay.imageSize[1]);
    maxZoom0G = Math.ceil(Math.log(maxDimensionG / TILE_SIZE) / Math.log(2)) +
        MIN_ZOOM_OFFSET;
    var maxZoom = (maxZoom0G +
               settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION);
    if (0) {
        console.log(Math.max(overlay.imageSize[0], overlay.imageSize[1]));
        console.log(overlay.imageSize);
        console.log(maxZoom);
    }

    var imageMapTypeOptions = {
        getTileUrl: getImageTileUrl,
        tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
        maxZoom: maxZoom,
        minZoom: MIN_ZOOM_OFFSET,
        radius: 1738000,
        name: 'image-map'
    };

    imageMapType = new google.maps.ImageMapType(imageMapTypeOptions);

    initialize_map();
    initialize_image();
    initialize_search_bar();
}

function initialize_search_bar() {
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

function initialize_map() {
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

    if (overlay.points) {
        for (var point = 0; point < overlay.points.length; point++) {
            var meters = {
                x: overlay.points[point].slice(0, 2)[0],
                y: overlay.points[point].slice(0, 2)[1]
            };
            var latLng = metersToLatLon(meters);
            var coord = meters;
            var index = mapMarkersG.length;
            var markerOpts = {
                title: '' + (index + 1),
                draggable: true,
                position: latLng,
                map: mapG,
                icon: markerIconG,
                labelContent: '' + (index + 1),
                labelAnchor: new google.maps.Point(20, 30),
                labelClass: 'labels',
                raiseOnDrag: false
            };
            var marker = new MarkerWithLabel(markerOpts);
            google.maps.event.addListener(marker, 'dragstart', function(event) {
                draggingG = true;
            });
            google.maps.event.addListener(marker, 'dragend', function(i) {
                return function(event) {
                    handleMapMarkerDragEnd(i, event);
                    setTimeout(function() {draggingG = false;}, 100);
                }
            }(index));
            (google.maps.event.addListener
             (marker, 'rightclick', function(i) {
                return function(event) {
                  handleMapMarkerRightClick(i, event);
                }
              }(index)));
            mapMarkersG[index] = marker;
            mapCoordsG[index] = coord;
        }
    }
}

function initialize_image() {
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

    imageMapG.mapTypes.set('image-map', imageMapType);
    imageMapG.setMapTypeId('image-map');

    google.maps.event.addListener(imageMapG, 'click', handleImageClick);

    if (overlay.points) {
        for (var point = 0; point < overlay.points.length; point++) {
            var pixels = {
                x: overlay.points[point].slice(2)[0],
                y: overlay.points[point].slice(2)[1]
            };
            var latLng = pixelsToLatLon(pixels);
            var coord = overlay.points[point].slice(2);
            var index = imageMarkersG.length;
            var markerOpts = {
                title: '' + (index + 1),
                draggable: true,
                position: latLng,
                map: imageMapG,
                icon: markerIconG,
                labelContent: '' + (index + 1),
                labelAnchor: new google.maps.Point(20, 30),
                labelClass: 'labels',
                raiseOnDrag: false
            };
            var marker = new MarkerWithLabel(markerOpts);
            google.maps.event.addListener(marker, 'dragstart', function(event) {
                draggingG = true;
            });
            google.maps.event.addListener(marker, 'dragend', function(i) {
                return function(event) {
                    handleImageMarkerDragEnd(i, event);
                    setTimeout(function() {draggingG = false;}, 100);
                }
            }(index));
            (google.maps.event.addListener
             (marker, 'rightclick', function(i) {
                return function(event) {
                 handleImageMarkerRightClick(i, event);
                }
             }(index)));
            imageMarkersG[index] = marker;
            imageCoords[index] = pixels;
        }
    }
}

function handleNoGeolocation(errorFlag) {
    fitNamedBounds(settings.GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT);
}

function getNormalizedCoord(coord, zoom) {
    var y = coord.y;
    var x = coord.x;

    var tileRange = 1 << zoom;

    if (y < 0 || y >= tileRange)
        return null;

    if (x < 0 || x >= tileRange)
        x = (x % tileRange + tileRange) % tileRange;

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
    var markerOpts = {
        title: '' + (index + 1),
        draggable: true,
        position: latLng,
        map: imageMapG,
        icon: markerIconG,
        labelContent: '' + (index + 1),
        labelAnchor: new google.maps.Point(20, 30),
        labelClass: 'labels'
    };
    var marker = new MarkerWithLabel(markerOpts);
    google.maps.event.addListener(marker, 'dragstart', function(event) {
        draggingG = true;
    });
    google.maps.event.addListener(marker, 'dragend', function(event) {
        handleImageMarkerDragEnd(index, event);
        setTimeout(function() {draggingG = false;}, 100);
    });
    google.maps.event.addListener(marker, 'rightclick', function(event) {
        handleImageMarkerRightClick(index, event);
    });
    imageMarkersG[index] = marker;
    imageCoords[index] = coord;
}

function handleMapClick(event) {
    if (draggingG) return;
    actionPerformed();
    var latLng = event.latLng;
    var coord = latLonToMeters(latLng);
    var index = mapMarkersG.length;
    var markerOpts = {
        title: '' + (index + 1),
        draggable: true,
        position: latLng,
        map: mapG,
        icon: markerIconG,
        labelContent: '' + (index + 1),
        labelAnchor: new google.maps.Point(20, 30),
        labelClass: 'labels'
    };
    var marker = new MarkerWithLabel(markerOpts);
    google.maps.event.addListener(marker, 'dragstart', function(event) {
        draggingG = true;
    });
    google.maps.event.addListener(marker, 'dragend', function(event) {
        handleMapMarkerDragEnd(index, event);
        setTimeout(function() {draggingG = false;}, 100);
    });
    google.maps.event.addListener(marker, 'rightclick', function(event) {
        handleMapMarkerRightClick(index, event);
    });
    mapMarkersG[index] = marker;
    mapCoordsG[index] = coord;
}

function handleImageMarkerDragEnd(markerIndex, event) {
    var coords = latLonToPixel(event.latLng);
    imageCoords[markerIndex] = coords;
}

function handleMapMarkerDragEnd(markerIndex, event) {
    var coords = latLonToMeters(event.latLng);
    mapCoordsG[markerIndex] = coords;
}

function handleImageMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    imageCoords[markerIndex] = null;
    imageMarkersG[markerIndex].setMap(null);
    imageMarkersG[markerIndex] = null;
}

function handleMapMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    mapCoordsG[markerIndex] = null;
    mapMarkersG[markerIndex].setMap(null);
    mapMarkersG[markerIndex] = null;
}

function warpButtonClicked(key) {
    if (warpButtonTimeoutG != null)
        clearTimeout(warpButtonTimeoutG);
    if (otherWarpButtonTimeoutG != null)
        clearTimeout(otherWarpButtonTimeoutG);
    $('#warp_button')[0].disabled = true;
    $('#warp_button')[0].value = 'warping...';
    $.post(overlay.url.replace('.json', '/warp'))
        .success(function(data, status, khr) {
            $('#warp_button')[0].disabled = false;
            $('#warp_button')[0].value = 'success!';
            warpButtonTimeoutG = setTimeout(function() {
                $('#warp_button')[0].value = 'warp';
            }, 3000);
        })
        .error(function(xhr, status, error) {
            $('#warp_button')[0].disabled = false;
            $('#warp_button')[0].value = 'warp';
            alert('Error occurred during warping: ' + error);
        });
    otherWarpButtonTimeoutG = setTimeout(function() {
        if ($('#warp_button')[0].disabled) {
            $('#warp_button')[0].value = 'still warping...';
            $('#warp_button')[0].disabled = false;
        }
    }, 10000);
}

function save(jsonData) {
    if (imageCoords.length) {
        var points = new Array();
        for (var i = 0; i < imageCoords.length; i++) {
            var coords = new Array();
            coords[0] = mapCoordsG[i].x;
            coords[1] = mapCoordsG[i].y;
            coords[2] = imageCoords[i].x;
            coords[3] = imageCoords[i].y;
            points[points.length] = coords;
        }
        jsonData.points = points;
        jsonData.transform = calculateAlignmentModel(points);
    } else {
        jsonData.points = new Array();
        jsonData.transform = {
            'type': '',
            'matrix': new Array()
        };
    }

    jsonData.name = $('#title')[0].value;

    $.post(overlay.url, JSON.stringify(jsonData))
        .success(function(data, status, xhr) {
            $('#save_button')[0].value = 'success!';
            $('#save_button')[0].disabled = false;
            saveButtonTimeoutG = setTimeout(function() {
                $('#save_button')[0].value = 'save';
            }, 3000);
        })
        .error(function(xhr, status, error) {
            $('#save_button')[0].value = 'save';
            $('#save_button')[0].disabled = false;
            alert('Error occurred while saving: ' + error);
        });
}

function saveButtonClicked() {
    if (saveButtonTimeoutG != null)
        clearTimeout(saveButtonTimeoutG);
    if (otherSaveButtonTimeoutG != null)
        clearTimeout(otherSaveButtonTimeoutG);
    if (mapCoordsG.length != imageCoords.length) {
        var diff = mapCoordsG.length - imageCoords.length;
        if (diff > 0) // need to add points to image
            $('#save_button')[0].value = 'Add ' + diff + ' to image';
        else
            $('#save_button')[0].value = 'Add ' + (-diff) + ' to map';
        saveButtonTimeoutG = setTimeout(function() {
            $('#save_button')[0].value = 'save';
        }, 3000);
        return;
    }

    $('#save_button')[0].disabled = true;
    $('#save_button')[0].value = 'saving...';
    $.getJSON(overlay.url)
        .success(save)
        .error(function(xhr, status, error) {
            $('#save_button')[0].value = 'save';
            $('#save_button')[0].disabled = false;
            alert('Error occurred while saving: ' + error);
        });
    otherSaveButtonTimeoutG = setTimeout(function() {
        if ($('#save_button')[0].disabled) {
            $('#save_button')[0].value = 'still saving...';
            $('#save_button')[0].disabled = false;
        }
    }, 3000);
}

function resetButtonClicked() {
    actionPerformed();
    reset();
}

function reset() {
    for (var marker in imageMarkersG) {
        if (imageMarkersG[marker].setMap)
            imageMarkersG[marker].setMap(null);
    }
    for (var marker in mapMarkersG) {
        if (mapMarkersG[marker].setMap)
            mapMarkersG[marker].setMap(null);
    }
    imageMarkersG = new Array();
    mapMarkersG = new Array();
    imageCoords = new Array();
    mapCoordsG = new Array();
}

function pushState(stack) {
    var data = overlay;
    if (imageCoords.length || mapCoordsG.length) {
        var points = new Array();
        var n = Math.max(imageCoords.length, mapCoordsG.length);
        for (var i = 0; i < n; i++) {
            var coords = new Array();
            if (i < mapCoordsG.length) {
                coords[0] = mapCoordsG[i].x;
                coords[1] = mapCoordsG[i].y;
            } else {
                coords[0] = null;
                coords[1] = null;
            } if (i < imageCoords.length) {
                coords[2] = imageCoords[i].x;
                coords[3] = imageCoords[i].y;
            } else {
                coords[2] = null;
                coords[3] = null;
            }
            points[points.length] = coords;
        }
        data.points = points;
    } else {
        data.points = new Array();
    }
    var newJson = JSON.stringify(data);
    stack.push(newJson);
}

function popState(stack) {
    if (stack.length < 1) return;
    reset(); // clear state
    var data = JSON.parse(stack.pop());

    if (data.points) {
        for (var point = 0; point < data.points.length; point++) {
            var pixels = {
                x: data.points[point].slice(2)[0],
                y: data.points[point].slice(2)[1]
            };
            var meters = {
                x: data.points[point].slice(0, 2)[0],
                y: data.points[point].slice(0, 2)[1]
            };
            if (pixels.x != null && pixels.y != null) {
                var latLng = pixelsToLatLon(pixels);
                var coord = data.points[point].slice(2);
                var index = imageMarkersG.length;
                var markerOpts = {
                    title: '' + (index + 1),
                    draggable: true,
                    position: latLng,
                    map: imageMapG,
                    icon: markerIconG,
                    labelContent: '' + (index + 1),
                    labelAnchor: new google.maps.Point(20, 30),
                    labelClass: 'labels'
                };
                var marker = new MarkerWithLabel(markerOpts);
                (google.maps.event.addListener
                 (marker, 'dragstart', function(event) {
                     draggingG = true;
                 }));
                (google.maps.event.addListener
                 (marker, 'dragend', function(event) {
                     handleImageMarkerDragEnd(index, event);
                     setTimeout(function() {draggingG = false;}, 100);
                 }));
                (google.maps.event.addListener
                 (marker, 'rightclick', function(event) {
                     handleImageMarkerRightClick(index, event);
                 }));
                imageMarkersG[index] = marker;
                imageCoords[index] = pixels;
            }
            if (meters.x != null && meters.y != null) {
                var latLng = metersToLatLon(meters);
                var coord = meters;
                var index = mapMarkersG.length;
                var markerOpts = {
                    title: '' + (index + 1),
                    draggable: true,
                    position: latLng,
                    map: mapG,
                    icon: markerIconG,
                    labelContent: '' + (index + 1),
                    labelAnchor: new google.maps.Point(20, 30),
                    labelClass: 'labels'
                };
                var marker = new MarkerWithLabel(markerOpts);
                (google.maps.event.addListener
                 (marker, 'dragstart', function(event) {
                     draggingG = true;
                 }));
                (google.maps.event.addListener
                 (marker, 'dragend', function(event) {
                     handleMapMarkerDragEnd(index, event);
                     setTimeout(function() {draggingG = false;}, 100);
                 }));
                (google.maps.event.addListener
                 (marker, 'rightclick', function(event) {
                     handleMapMarkerRightClick(index, event);
                 }));
                mapMarkersG[index] = marker;
                mapCoordsG[index] = coord;
            }
        }
    }

    return JSON.stringify(data);
}

function undo() {
    if (undoStackG.length < 1) return;
    pushState(redoStackG);
    popState(undoStackG);
}

function redo() {
    if (redoStackG.length < 1) return;
    pushState(undoStackG);
    popState(redoStackG);
}

function actionPerformed() {
    if (redoStackG.length > 0) {
    for (var i = 0; i < redoStackG.length; i++)
        undoStackG.push(redoStackG.pop());
    }
    pushState(undoStackG);
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

function debugFit() {
    var U = getProjectiveUMatrixFromPoints(overlay.points);
    var T = new Matrix(overlay.transform.matrix);
    var V = getVMatrixFromPoints(overlay.points);
    var Vapprox = applyTransform(overlay.transform, overlay.points);
    var Verror = Vapprox.subtract(V);
    var b = $('body');
    b.append('U:');
    U.print();
    b.append('T:');
    T.print();
    b.append('V:');
    V.print();
    b.append('Vapprox:');
    Vapprox.print();
    b.append('Verror:');
    Verror.print();
    $('.matrix').css('padding', '5px');
    $('.matrix td').css('padding-left', '10px');

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
