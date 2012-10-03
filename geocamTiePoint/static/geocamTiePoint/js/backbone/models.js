var app = app || {};
app.models = app.models || {};

// All these globals should be loaded from elsewhere.
assert(! _.isUndefined(getNormalizedCoord),
       'Missing global: getNormalizedCoord');
assert(! _.isUndefined(fillTemplate),
       'Missing global: fillTemplate');
assert(! _.isUndefined(TILE_SIZE),
       'Missing global: TILE_SIZE');
assert(! _.isUndefined(MIN_ZOOM_OFFSET),
       'Missing global: MIN_ZOOM_OFFSET');

$(function($) {
    app.models.Overlay = Backbone.Model.extend({
        idAttribute: 'key', // Backend uses "key" as the primary key

        initialize: function(){
            // Bind all the model's function properties to the instance, so they can be passed around as event handlers and such.
            _.bindAll(this);
        },

        url: function() {
            var pk = _.isUndefined(this.get('id')) ? this.get('key') : this.get('id');
            return this.get('url') || '/overlay/' + pk + '.json';
        },

        getImageTileUrl: function(coord, zoom) {
            var normalizedCoord = getNormalizedCoord(coord, zoom);
            if (!normalizedCoord) { return null; }
            var url = fillTemplate(this.get('unalignedTilesUrl'), {
                zoom: zoom,
                x: normalizedCoord.x,
                y: normalizedCoord.y
            });
            return url;
        },

        getAlignedImageTileUrl: function(coord, zoom) {
            var normalizedCoord = getNormalizedCoord(coord, zoom);
            if (!normalizedCoord) {return null;}
            return fillTemplate(this.get('alignedTilesUrl'),
                {zoom: zoom,
                 x: normalizedCoord.x,
                 y: normalizedCoord.y});
        },

        maxDimension: function() {
            var size = this.get('imageSize');
            if (_.isUndefined(size)) {
                throw "Overlay image's size is not defined or not yet loaded.";
            }
            return Math.max(size[0], size[1]);
        },

        maxZoom: function() {
            var mz = (Math.ceil(Math.log(this.maxDimension() / TILE_SIZE) /
                                Math.log(2)) +
                      MIN_ZOOM_OFFSET);
            return mz;
        },

        imageBounds: function() {
            var imageSize = this.get('imageSize');
            var sw = pixelsToLatLon({x: 0, y: imageSize[1]}, this.maxZoom());
            var ne = pixelsToLatLon({x: imageSize[0], y: 0}, this.maxZoom());
            var bounds = new google.maps.LatLngBounds(sw, ne);
            return bounds;
        },

        mapBounds: function() {
            var bounds = this.get('bounds');
            return new google.maps.LatLngBounds(
                new google.maps.LatLng(bounds.south, bounds.west),
                new google.maps.LatLng(bounds.north, bounds.east)
            );
        },

        /**
         * Update one "side" (map or image) of an entry in the model's tipeoing array.
         * Will add a new tiepoint if one doesn't already exist at that index.
        */
        updateTiepoint: function( whichSide, pointIndex, coords ) {
            var points = this.get('points');
            var tiepoint = points[pointIndex] || [null,null,null,null];
            var coordIdx= {
                'map': [0,1],
                'image': [2,3],
            }[whichSide];
            assert(coordIdx, "Unexpected whichSide argument: "+whichSide);
            tiepoint[coordIdx[0]] = coords.x;
            tiepoint[coordIdx[1]] = coords.y;
            points[pointIndex] = tiepoint;
            this.set('points', points);
            this.trigger('change:points');  // Manually trigger this, because the value of model.points (an array reference) hasn't actually changed.
        },

        computeTransform: function() {
            // only operate on points that have all four values.
            var points = _.filter(this.get('points'), function(coords){return _.all(coords, _.identity);});
            this.set('transform', 
                points ? geocamTiePoint.transform.getTransform(points).toDict() : {type: '', matrix: []}
            );
        },

        save: function(attributes, options) {
            // Always compute transform on before save.
            this.computeTransform();
            return Backbone.Model.prototype.save.call(this, attributes, options);
        },

        warp: function(options) {
            // Save the overlay, then trigger a server-side warp.
            options = options || {};
            var warpUrl = this.url().replace('.json', '/warp');
            saveOptions = {
                error: options.error || function(){},
                success: function() {
                    var jqXHR = $.post(warpUrl);
                    if (options.success) { jqXHR.success(options.success); }
                    if (options.error) { jqXHR.error(options.error); }
                },
            };
            this.save({}, saveOptions);
        },

    });

    app.OverlayCollection = Backbone.Collection.extend({
        model: app.models.Overlay,
        url: '/overlays.json'
    });

    app.overlays = new app.OverlayCollection();
});
