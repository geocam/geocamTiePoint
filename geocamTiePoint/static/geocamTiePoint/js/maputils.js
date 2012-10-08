var maputils = maputils || {};

$(function($) {
    /*
     * Map helper stuff... cleaned up versions of code formerly found in
     * overlay-view.js Probably this stuff should find a new home.
     * Depends upon constants defined in in coords.js.  and
     * fitNamedBounds, defined in utils.js
    */

    maputils.handleNoGeolocation = function(gmap, errorFlag) {
        assert(! _.isUndefined(fitNamedBounds),
               'Missing global: fitNamedBounds');
        fitNamedBounds(settings.GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT,
                       gmap);
    }

    maputils.ImageMapType = function(overlayModel) {
        assert(typeof TILE_SIZE !== 'undefined',
               'Missing global: TILE_SIZE');
        assert(typeof MIN_ZOOM_OFFSET !== 'undefined',
               'Missing global: MIN_ZOOM_OFFSET');
        var levelsPast =
            settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION;
        assert(typeof levelsPast !== 'undefined',
               'Missing: settings.' +
               'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION');
        return new google.maps.ImageMapType({
            getTileUrl: overlayModel.getImageTileUrl,
            tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
            maxZoom: (overlayModel.maxZoom() + levelsPast),
            minZoom: MIN_ZOOM_OFFSET,
            name: 'image-map'
        });
    };

    maputils.AlignedImageMapType = function(overlayModel) {
        assert(typeof TILE_SIZE !== 'undefined',
               'Missing global: TILE_SIZE');
        assert(typeof MIN_ZOOM_OFFSET !== 'undefined',
               'Missing global: MIN_ZOOM_OFFSET');
        var levelsPast =
            settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION;
        assert(typeof levelsPast !== 'undefined',
               'Missing: settings.' +
               'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION');
        return new google.maps.ImageMapType({
            getTileUrl: overlayModel.getAlignedImageTileUrl,
            tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
            maxZoom: (overlayModel.maxZoom() + levelsPast),
            minZoom: MIN_ZOOM_OFFSET,
            name: 'image-map'
        });
    };


    maputils.createLabeledMarker = function(latLng, label, map, options) {
        var unselectedIcon =
            'http://maps.gstatic.com/mapfiles/markers2/marker_blank.png';
        var selectedIcon =
            'http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue.png';
        var markerOpts = {
            title: ''+label,
            draggable: true,
            position: latLng,
            map: map,
            icon: new google.maps.MarkerImage(unselectedIcon),
            labelContent: label,
            labelAnchor: new google.maps.Point(20, 30),
            labelClass: 'labels',
            raiseOnDrag: false
        };
        markerOpts = _.extend(markerOpts, options);
        var marker = new MarkerWithLabel(markerOpts);
        google.maps.event.addListener(marker, 'selected_changed', function() {
            marker.setIcon(marker.get('selected') ?
                           selectedIcon :
                           unselectedIcon);
        });
        return marker;
    };

    maputils.locationSearchBar = function (search_bar, mapG) {
        // expecting search_bar to either be a selector string or a jquery object.
        var input = _.isString(search_bar) ? $(search_bar)[0] : search_bar[0];
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

    };

});


//set up a transparency slider
maputils.createOpacityControl = function(map, mapType, opacity) {
    var OPACITY_MAX_PIXELS = 57;
    var sliderImageUrl = '/static/geocamTiePoint/images/opacity-slider3d6.png';

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

    google.maps.event.addListener(opacityCtrlKnob, 'drag', function() {
            setOpacity(mapType, opacityCtrlKnob.valueX());
    });

    google.maps.event.addDomListener(opacityDiv, 'click', function(e) {
        var left = findPosLeft(this);
        var x = e.pageX - left - 5;
        opacityCtrlKnob.setValueX(x);
        setOpacity(mapType, x);
    });

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(opacityDiv);
    var initialValue = OPACITY_MAX_PIXELS / (100 / opacity);
    opacityCtrlKnob.setValueX(initialValue);
    setOpacity(mapType, initialValue);

    function setOpacity(mapType, pixelX) {
        // pixelX in range 0 to OPACITY_MAX_PIXELS
        var opacityPercent = (100 / OPACITY_MAX_PIXELS) * pixelX;

        if (opacityPercent < 0) opacityPercent = 0;
        if (opacityPercent > 100) opacityPercent = 100;

        //console.log("opacity: " + opacityPercent);
        mapType.setOpacity(opacityPercent / 100.0);
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

}

