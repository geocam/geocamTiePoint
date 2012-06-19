//var overlay = {{ overlay.data|safe }};
//var data_url = "{{ DATA_URL }}";

var tileSize = 256;
var initialResolution = 2 * Math.PI * 6378137 / tileSize;
var originShift = 2 * Math.PI * 6378137 / 2.0;

// find max zoom
var maxZoom = 0; var offset = 3;
if (overlay['imageSize'][0] > overlay['imageSize'][1]) {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][0] / tileSize, 2)) + offset;
} else {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][1] / tileSize, 2)) + offset;
}

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