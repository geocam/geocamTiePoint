var tileSize=256;
var offset=3;
var opac = 0.4;
var OPACITY_MAX_PIXELS = 57; 
var imageOverlay;

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
    opacity: parseFloat(opac),
    name: "transformed-image-map"
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

    var initialOpacity = 40;
   // imageOverlay = new CustomTileOverlay(map,initialOpacity);
   // imageOverlay.show();

    createOpacityControl(map,initialOpacity);
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

//set up a transparency slider
function createOpacityControl(map, opacity) {
    var sliderImageUrl =  data_url+"geocamTiePoint/images/opacity-slider3d6.png";

    // Create main div to hold the control.
    var opacityDiv = document.createElement('DIV');
    opacityDiv.setAttribute("style", "margin:5px;overflow-x:hidden;overflow-y:hidden;background:url(" + sliderImageUrl + ") no-repeat;width:71px;height:21px;cursor:pointer;");

    // Create knob
    var opacityKnobDiv = document.createElement('DIV');
    opacityKnobDiv.setAttribute("style", "padding:0;margin:0;overflow-x:hidden;overflow-y:hidden;background:url(" + sliderImageUrl + ") no-repeat -71px 0;width:14px;height:21px;");
    opacityDiv.appendChild(opacityKnobDiv);

    var opacityCtrlKnob = new ExtDraggableObject(opacityKnobDiv, {
                            restrictY: true,
                            container: opacityDiv
    });

    google.maps.event.addListener(opacityCtrlKnob, "dragend", function() {
            setOpacity(opacityCtrlKnob.valueX());
    });

    google.maps.event.addDomListener(opacityDiv, "click", function(e) {
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
    //Range 0 to OPACITY_MAX_PIXELS
    var value = (100 / OPACITY_MAX_PIXELS)* pixelX;
    if (value < 0) value = 0;
    if (value ==0) {
    } else {
        transformedImageMapType.setOpacity((100 / OPACITY_MAX_PIXELS) * pixelX /100);
        console.log("opacity : "+(100 / OPACITY_MAX_PIXELS) * pixelX)/100;
    }   
}


/*
function setOpacity(pixelX) {
    // Range = 0 to OPACITY_MAX_PIXELS
    var value = (100 / OPACITY_MAX_PIXELS) * pixelX;
    if (value < 0) value = 0;
    if (value == 0) {
        if (imageOverlay.visible == true) {
            imageOverlay.hide();
        }
    }
    else {
        imageOverlay.setOpacity(value);
        if (imageOverlay.visible == false) {
            imageOverlay.show();
        }
    }
}
*/
function findPosLeft(obj) {
    var curleft = 0;
    if (obj.offsetParent) {
        do {
            curleft +=obj.offsetLeft;
        } while (obj = obj.offsetParent);
        return curleft;
    }
    return undefined;
}

