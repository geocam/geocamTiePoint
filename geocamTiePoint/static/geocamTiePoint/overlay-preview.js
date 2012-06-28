var tileSize=256;
var offset=3;

// find max zoom
var maxZoom = 0; var offset = 3;
if (overlay['imageSize'][0] > overlay['imageSize'][1]) {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][0] / tileSize, 2)) + offset;
} else {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][1] / tileSize, 2)) + offset;
}

function getTransformedImageTileUrl(coord,zoom) {
    var normalizedCoord = getNormalizedCoord(coord,zoom);
        
    if(!normalizedCoord)
        return null;
    var bounds = Math.pow(2,zoom);
    return data_url+"geocamTiePoint/registeredTiles/"+overlay['key']+
        '/'+zoom+'/'+normalizedCoord.x+'/'+normalizedCoord.y+'.png';
}

var transformedImageMapTypeOptions = {
    getTileUrl: getTransformedImageTileUrl,
    tileSize: new google.maps.Size(tileSize,tileSize),
    maxZoom: maxZoom,
    minZoom: offset,
    radius: 1738000,
    name: "transformed-image-map",
    opacity: 0.5
}

var transformedImageMapType = new google.maps.ImageMapType(transformedImageMapTypeOptions);

var map;
var currCity = new google.maps.LatLng(0,0);//figure this out form tie points

function initialize() {
    var mapOptions = {
        zoom: 1,
        center: currCity,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"),mapOptions);

    //insert the overlay map as first overlay map type at position 0
    map.overlayMapTypes.insertAt(0, transformedImageMapType);
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

function showValue(newValue) {
    document.getElementById("range").innerHTML=newValue;
}
