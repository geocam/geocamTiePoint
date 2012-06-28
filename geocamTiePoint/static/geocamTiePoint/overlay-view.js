//var overlay = {{ overlay.data|safe }};
//var data_url = "{{ DATA_URL }}";

var tileSize = 256;
var initialResolution = 2 * Math.PI * 6378137 / tileSize;
var originShift = 2 * Math.PI * 6378137 / 2.0;

// find max zoom
var offset = 3;
var maxDimension = Math.max(overlay['imageSize'][0], overlay['imageSize'][1]);
var maxZoom = Math.ceil(Math.log(maxDimension / tileSize)/Math.log(2)) + offset;
console.log(Math.max(overlay['imageSize'][0], overlay['imageSize'][1]));
console.log(overlay['imageSize']);
console.log(maxZoom);

var map; var image_map;

var imageMapTypeOptions = {
    getTileUrl: getImageTileUrl,
    tileSize: new google.maps.Size(tileSize, tileSize),
    maxZoom: maxZoom,
    minZoom: offset,
    radius: 1738000,
    name: "image-map"
};

var imageMapType = new google.maps.ImageMapType(imageMapTypeOptions);

var imageMarkers = new Array();
var mapMarkers = new Array();

var imageCoords = new Array();
var mapCoords = new Array();

var saveButtonTimeout = null;
var otherSaveButtonTimeout = null;
var warpButtonTimeout = null;
var otherWarpButtonTimeout = null;

var markerIcon = new google.maps.MarkerImage("http://maps.gstatic.com/mapfiles/markers2/marker_blank.png");

var dragging = false;

function getImageTileUrl(coord, zoom) {
    var normalizedCoord = getNormalizedCoord(coord, zoom);

    if (!normalizedCoord)
	return null;

    var bounds = Math.pow(2,zoom);
    return data_url+"geocamTiePoint/tiles/" + overlay['key'] +
	'/' + zoom + '/' + normalizedCoord.x + '/' +
	normalizedCoord.y + '.jpg';
}

function initialize() {
    initialize_map();
    initialize_image();
    initialize_search_bar();
}

function initialize_search_bar() {
    var input = document.getElementById('searchTextField');
    var autoComplete = new google.maps.places.Autocomplete(input);

    autoComplete.bindTo('bounds', map);

    var infoWindow = new google.maps.InfoWindow();
    var marker = new google.maps.Marker({
	map: map
    });

    google.maps.event.addListener(autoComplete, 'place_changed', function() {
	infoWindow.close();
	var place = autoComplete.getPlace();
	if (place.geometry.viewport) {
	    map.fitBounds(place.geometry.viewport)
	} else {
	    map.setCenter(place.geometry.location);
	    map.setZoom(17);
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

	infoWindow.setContent('<div><strong>' + place.name + '</strong><br>' + address + '</div>');
	infoWindow.open(map, marker);
    });
}

function initialize_map() {
    var mapOptions = {
	zoom: 6,
	mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

    if (navigator.geolocation) {
	navigator.geolocation.getCurrentPosition(function (position) {
	    var pos = new google.maps.LatLng(position.coords.latitude,
					     position.coords.longitude);
	    map.setCenter(pos);
	}, function() {
	    handleNoGeolocation(true);
	});
    } else {
	// browser doesn't support geolocation
	handleNoGeolocation(false);
    }

    google.maps.event.addListener(map, "click", handleMapClick);

    if (overlay['points']) {
	for (var point=0;point<overlay['points'].length;point++) {
	    var meters = {
		x:overlay['points'][point].slice(0,2)[0],
		y:overlay['points'][point].slice(0,2)[1],
	    };
	    var latLng = metersToLatLon(meters);
	    var coord = meters;
	    var index = mapMarkers.length;
	    var markerOpts = {
		title: "" + (index + 1),
		draggable: true,
		position: latLng,
		map: map,
		icon: markerIcon,
		labelContent: "" + (index + 1),
		labelAnchor: new google.maps.Point(20,30),
		labelClass: "labels",
	    };
	    var marker = new MarkerWithLabel(markerOpts);
	    google.maps.event.addListener(marker, "dragstart", function(event) {
		dragging = true;
	    });
	    google.maps.event.addListener(marker, "dragend", function(event) {
		handleMapMarkerDragEnd(index, event);
		setTimeout(function(){dragging = false;}, 100);
	    });
	    google.maps.event.addListener(marker, "rightclick", function(event) {
		handleMapMarkerRightClick(index, event);
	    });
	    mapMarkers[index] = marker;
	    mapCoords[index] = coord;
	}
    }
}

function initialize_image() {
    var mapOptions = {
	center: new google.maps.LatLng(83, -165),
	zoom: 1,
	streetViewControl: false,
	backgroundColor: "rgb(0,0,0)",
	mapTypeControlOptions: {
	    mapTypeId: ["image-map"]
	}
    };

    image_map = new google.maps.Map(document.getElementById("image_canvas"), mapOptions);

    image_map.mapTypes.set('image-map', imageMapType);
    image_map.setMapTypeId('image-map');

    google.maps.event.addListener(image_map, "click", handleImageClick);

    if (overlay['points']) {
	for (var point=0; point<overlay['points'].length; point++) {
	    var pixels = {
		x: overlay['points'][point].slice(2)[0],
		y: overlay['points'][point].slice(2)[1],
	    };
	    var latLng = pixelsToLatLon(pixels);
	    var coord = overlay['points'][point].slice(2);
	    var index = imageMarkers.length;
	    var markerOpts ={
		title: "" + (index + 1),
		draggable: true,
		position: latLng,
		map: image_map,
		icon: markerIcon,
		labelContent: "" + (index + 1),
		labelAnchor: new google.maps.Point(20,30),
		labelClass: "labels",
	    };
	    var marker = new MarkerWithLabel(markerOpts);
	    google.maps.event.addListener(marker, "dragstart", function(event) {
		dragging = true;
	    });
	    google.maps.event.addListener(marker, "dragend", function(event) {
		handleImageMarkerDragEnd(index, event);
		setTimeout(function(){dragging = false;}, 100);
	    });
	    google.maps.event.addListener(marker, "rightclick", function(event) {
		handleImageMarkerRightClick(index, event);
	    });
	    imageMarkers[index] = marker;
	    imageCoords[index] = pixels;
	}
    }
}

function handleNoGeolocation(errorFlag) {
    map.setCenter(new google.maps.LatLng(60, 105));
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
    if (dragging) return;
    var latLng = event.latLng;
    var coord = latLonToPixel(latLng);
    var index = imageMarkers.length;
    var markerOpts ={
	title: "" + (index + 1),
	draggable: true,
	position: latLng,
	map: image_map,
	icon: markerIcon,
	labelContent: "" + (index + 1),
	labelAnchor: new google.maps.Point(20,30),
	labelClass: "labels",
    };
    var marker = new MarkerWithLabel(markerOpts);
    google.maps.event.addListener(marker, "dragstart", function(event) {
	dragging = true;
    });
    google.maps.event.addListener(marker, "dragend", function(event) {
	handleImageMarkerDragEnd(index, event);
	setTimeout(function(){dragging = false;}, 100);
    });
    google.maps.event.addListener(marker, "rightclick", function(event) {
	handleImageMarkerRightClick(index, event);
    });
    imageMarkers[index] = marker;
    imageCoords[index] = coord;
}

function handleMapClick(event) {
    if (dragging) return;
    var latLng = event.latLng;
    var coord = latLonToMeters(latLng);
    var index = mapMarkers.length;
    var markerOpts = {
	title: "" + (index + 1),
	draggable: true,
	position: latLng,
	map: map,
	icon: markerIcon,
	labelContent: "" + (index + 1),
	labelAnchor: new google.maps.Point(20,30),
	labelClass: "labels",
    };
    var marker = new MarkerWithLabel(markerOpts);
    google.maps.event.addListener(marker, "dragstart", function(event) {
	dragging = true;
    });
    google.maps.event.addListener(marker, "dragend", function(event) {
	handleMapMarkerDragEnd(index, event);
	setTimeout(function(){dragging = false;}, 100);
    });
    google.maps.event.addListener(marker, "rightclick", function(event) {
	handleMapMarkerRightClick(index, event);
    });
    mapMarkers[index] = marker;
    mapCoords[index] = coord;
}

function handleImageMarkerDragEnd(markerIndex, event) {
    var coords = latLonToPixel(event.latLng);
    imageCoords[markerIndex] = coords;
}

function handleMapMarkerDragEnd(markerIndex, event) {
    var coords = latLonToMeters(event.latLng);
    mapCoords[markerIndex] = coords;
}

function handleImageMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    imageCoords[markerIndex] = null;
    imageMarkers[markerIndex].setMap(null);
    imageMarkers[markerIndex] = null;
}

function handleMapMarkerRightClick(markerIndex, event) {
    return; // this doesn't really work right now
    mapCoords[markerIndex] = null;
    mapMarkers[markerIndex].setMap(null);
    mapMarkers[markerIndex] = null;
}

function warpButtonClicked() {
    if (warpButtonTimeout != null)
	clearTimeout(warpButtonTimeout);
    if (otherWarpButtonTimeout != null)
	clearTimeout(otherWarpButtonTimeout);
    $('#warp_button')[0].disabled = true;
    $('#warp_button')[0].value = 'warping...';
    $.post('warp/')
	.success(function(data, status, khr) {
	    $('#warp_button')[0].disabled = false;
	    $('#warp_button')[0].value = "success!";
	    warpButtonTimeout = setTimeout(function() {
		$('#warp_button')[0].value = "warp";
	    }, 3000);
	})
	.error(function(xhr, status, error) {
	    $('#warp_button')[0].disabled = false;
	    $('#warp_button')[0].value = "warp";
	    alert("Error occurred during warping: " + error);
	});
    otherWarpButtonTimeout = setTimeout(function() {
	if ($('#warp_button')[0].disabled) {
	    $('#warp_button')[0].value = "still warping...";
	    $('#warp_button')[0].disabled = false;
	}
    }, 10000);
}

function save(jsonData) {
    if (imageCoords.length) {
	var points = new Array();
	for (var i=0; i<imageCoords.length; i++) {
	    var coords = new Array();
	    coords[0] = mapCoords[i].x;
	    coords[1] = mapCoords[i].y;
	    coords[2] = imageCoords[i].x;
	    coords[3] = imageCoords[i].y;
	    points[points.length] = coords;
	}
	var data = jsonData['data'];
	data['points'] = points;
	data['transform'] = generateMatrix(points, points.length);

	var newJson = JSON.stringify(data);
	jsonData['data'] = newJson;
    } else {
	var data = jsonData['data'];
	data['points'] = new Array();
	data['transform'] = {
	    'type': "",
	    'matrix': new Array()
	}
	var newJson = JSON.stringify(data);
	jsonData['data'] = newJson;
    }

    jsonData['name'] = $('#title')[0].value;

    $.post(overlay.url, jsonData)
	.success(function(data, status, xhr) {
	    $('#save_button')[0].value = "success!";
	    $('#save_button')[0].disabled = false;
	    saveButtonTimeout = setTimeout(function() {
		$('#save_button')[0].value = "save";
	    }, 3000);
	})
	.error(function(xhr, status, error) {
	    $('#save_button')[0].value = "save";
	    $('#save_button')[0].disabled = false;
	    alert("Error occurred while saving: " + error);
	});
}

function saveButtonClicked() {
    if (saveButtonTimeout != null)
	clearTimeout(saveButtonTimeout);
    if (otherSaveButtonTimeout != null)
	clearTimeout(otherSaveButtonTimeout);
    if (mapCoords.length != imageCoords.length) {
	var diff = mapCoords.length - imageCoords.length;
	if (diff > 0) // need to add points to image
	    $('#save_button')[0].value = "Add " + diff + " to image";
	else
	    $('#save_button')[0].value = "Add " + (-diff) + " to map";
	saveButtonTimeout = setTimeout(function(){
	    $('#save_button')[0].value = "save";
	}, 3000);
	return;
    }
    $('#save_button')[0].disabled = true;
    $('#save_button')[0].value = "saving...";
    $.getJSON(overlay.url)
	.success(save)
	.error(function(xhr, status, error) {
	    $('#save_button')[0].value = "save";
	    $('#save_button')[0].disabled = false;
	    alert("Error occurred while saving: " + error);
	});
    otherSaveButtonTimeout = setTimeout(function() {
	if ($('#save_button')[0].disabled) {
	    $('#save_button')[0].value = "still saving...";
	    $('#save_button')[0].disabled = false;
	}
    }, 3000);
}

function resetButtonClicked() {
    for (var marker in imageMarkers) {
	if (imageMarkers[marker].setMap)
	    imageMarkers[marker].setMap(null);
    }
    for (var marker in mapMarkers) {
	if (mapMarkers[marker].setMap)
	    mapMarkers[marker].setMap(null);
    }
    imageMarkers = new Array();
    mapMarkers = new Array();
    imageCoords = new Array();
    mapCoords = new Array();
}

function latLonToMeters(latLon) {
    var mx = latLon.lng() * originShift / 180;
    var my = Math.log(Math.tan((90 + latLon.lat()) * Math.PI / 360)) /
	(Math.PI / 180);
    my = my * originShift / 180;
    return {x:mx,
	    y:my};
}

function metersToLatLon(meters) {
    var lng = meters.x * 180 / originShift;
    var lat = meters.y * 180 / originShift;
    lat = ((Math.atan(Math.exp((lat * (Math.PI / 180)))) * 360) / Math.PI) - 90;
    var latLng = new google.maps.LatLng(lat,lng);
    return latLng;
}

function metersToPixels(meters) {
    var res = resolution(maxZoom);
    var px = (meters.x + originShift) / res;
    var py = (-meters.y + originShift) / res;
    return {x:px, y:py};
}

function pixelsToMeters(pixels) {
    var res = resolution(maxZoom);
    var mx = (pixels.x * res) - originShift;
    var my = -(pixels.y * res) + originShift;
    return {x:mx, y:my};
}

function resolution(zoom) {
    return initialResolution / (Math.pow(2,zoom));
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

    var greenIcon = new google.maps.MarkerImage("http://maps.google.com/mapfiles/ms/icons/green.png");
    var n = overlay.points.length;
    for (var i=0; i < n; i++) {
        var meterCoords = {x: Vapprox.values[0][i], y: Vapprox.values[1][i]};
        console.log(meterCoords);
        var latlng = metersToLatLon(meterCoords);
        console.log(latlng);
        var markerOpts = {
	    title: "" + (i + 1),
	    draggable: true,
	    position: latlng,
	    map: map,
	    icon: greenIcon,
	    labelContent: "" + (i + 1),
	    labelAnchor: new google.maps.Point(20,30),
	    labelClass: "labels",
        };
        var marker = new MarkerWithLabel(markerOpts);
    };

}
