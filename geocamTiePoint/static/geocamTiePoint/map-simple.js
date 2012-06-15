//USGSOverlay.prototype = new google.maps.OverlayView();
var labels = ["1","2","3","4","5","6","7","8","9"];
var i=0; var j=0;

//var overlay = {{ overlay.data|safe }}

var tileSize = 256;
var initialResolution = 2 * Math.PI * 6378137 / tileSize;
var originShift = 2 * Math.PI * 6378137 / 2.0;

// find max zoom
var maxZoom = 0; var offset = 3;
if (overlay['imageSize'][0] > overlay['imageSize'][1]) {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][0] / 256., 2))+offset;
    console.log(maxZoom);
} else {
    maxZoom = Math.ceil(Math.log(overlay['imageSize'][1] / 256., 2))+offset;
    console.log(maxZoom);
}
          
//SF MAP QUAD TREE
var sfMapTypeOptions = {
    getTileUrl: function(coord, zoom) {
	var normalizedCoord = getNormalizedCoord(coord, zoom);
          
	if(!normalizedCoord) {
            return null;
	}
	var bound = Math.pow(2,zoom);
	return "/data/geocamTiePoint/registeredTiles/"+ overlay['key'] +
	"/" + zoom + "/" + normalizedCoord.x + "/" +
	normalizedCoord.y + ".jpg";
    },
    tileSize: new google.maps.Size(256, 256),
    maxZoom: 15,
    minZoom: offset,
    radius: 1738000,
    name: "SF1920"
};

var sfMapType = new google.maps.ImageMapType(sfMapTypeOptions);      
      
//MARKER MANAGER
var mgr;
var allmarkers= [];    
var allmarkers2= [];    
 
function initialize() {
    var myLatLng = new google.maps.LatLng(37.7548025158956, -122.45542151199643);
      
    //MAP 1  
    var myOptions = {
	center: myLatLng,
	zoom: 11,
	mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var map = new google.maps.Map(document.getElementById("map_canvas"),
				  myOptions);

    var swBound = new google.maps.LatLng(37.681819, -122.517132);
    var neBound = new google.maps.LatLng(37.800471, -122.405608);
    var bounds = new google.maps.LatLngBounds(swBound,neBound);

    //MAP 2
    var myOptions2 = {
	center: myLatLng,
	zoom: 1,
	streetViewControl: false,
	backgroundColor: "rgb(0,0,0)",
	mapTypeControlOptions: {
            mapTypeId: ["sf1920"]
	}
    };

    var map2 = new google.maps.Map(document.getElementById("map_canvas2"),
				   myOptions2);
    map2.mapTypes.set('sf1920', sfMapType);
    map2.setMapTypeId('sf1920');
    map2.setCenter(myLatLng);
      
    //SEARCHBAR
    var input = document.getElementById('searchTextField');
    var autocomplete = new google.maps.places.Autocomplete(input);

    autocomplete.bindTo('bounds',map);

    var infowindow = new google.maps.InfoWindow();
    var marker = new google.maps.Marker({
            map: map
        });

    google.maps.event.addListener(autocomplete, 'place_changed',function() {
	    infowindow.close();
	    var place = autocomplete.getPlace();
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

	    infowindow.setContent('<div><strong>' + place.name + '</strong><br>' + address);
	    infowindow.open(map, marker);
        });

    //MARKER
    google.maps.event.addListener(map, 'click', function(event) {
	    placeMarker(allmarkers,labels[i++], event.latLng, map);
        });

    google.maps.event.addListener(map2, 'click', function(event) {
	    placeMarker(allmarkers2,labels[j++], event.latLng, map2);
        });
  
    // Sets a listener on a radio button to change the filter type on Places
    // Autocomplete.
    function setupClickListener(id, types) {
	var radioButton = document.getElementById(id);
	google.maps.event.addDomListener(radioButton, 'click', function() {
		autocomplete.setTypes(types);
	    });
    }

    setupClickListener('changetype-all', []);
    setupClickListener('changetype-establishment', ['establishment']);
    setupClickListener('changetype-geocode', ['geocode']);

    var image = 'image/icon24.png';
}

function placeMarker(markers, label, position, map) {
    latLonToPixel(position);
    var styleIconClass = new StyledIcon (
					 StyledIconTypes.CLASS,{color:"#ff0000"});
    var styleMaker1 = new StyledMarker(
				       {styleIcon:new StyledIcon
					(StyledIconTypes.MARKER,
    {text:label},styleIconClass),
					position:position,
					map:map,draggable:true});

    markers.push(styleMaker1);
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

      
function clearMarkers(){
    if (allmarkers) {
	for (var i = 0; i < allmarkers.length; i++ ) {
            allmarkers[i].setMap(null);
	}
    }
}

function clearMarkers2(){
    if (allmarkers2) {
	for (var i = 0; i < allmarkers2.length; i++ ) {
            allmarkers2[i].setMap(null);
	}
    }
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
    lat = ((Math.atan(Math.pow(2, (meters.y * (Math.PI / 180)))) * 360) / Math.PI) - 90;
    var latLng = new google.maps.LatLng({lat:lat,lng:lng});
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
    console.log([meters.x, meters.y]);
    var pixels = metersToPixels(meters);
    console.log([pixels.x, pixels.y]);
    return pixels;
}

function bound(value, opt_min, opt_max) {
    if (opt_min != null) value = Math.max(value, opt_min);
    if (opt_max != null) value = Math.min(value, opt_max);
    return value;
}