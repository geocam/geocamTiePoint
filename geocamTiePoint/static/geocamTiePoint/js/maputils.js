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


    maputils.createLabeledMarker = function(latLng, label, map, options) {
        var unselectedIcon =
            'http://maps.gstatic.com/mapfiles/markers2/marker_blank.png';
        var selectedIcon =
            'http://maps.google.com/intl/en_us/mapfiles/ms/micons/blue.png';
        var markerOpts = {
            title: label,
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
    }
});
