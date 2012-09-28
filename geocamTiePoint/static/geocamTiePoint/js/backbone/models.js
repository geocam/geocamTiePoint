var app = app || {};
app.models = app.models || {};

// All these globals should be loaded from elsewhere.
assert(! _.isUndefined(getNormalizedCoord),
       'Missing global: getNormalizedCoord');
assert(! _.isUndefined(getNormalizedCoord),
       'Missing global: fillTemplate');
assert(! _.isUndefined(TILE_SIZE),
       'Missing global: TILE_SIZE');
assert(! _.isUndefined(MIN_ZOOM_OFFSET),
       'Missing global: MIN_ZOOM_OFFSET');

$(function($) {
    app.models.Overlay = Backbone.Model.extend({
        idAttribute: 'key', // Backend uses "key" as the primary key
        url: function() {
            var pk = _.isUndefined(this.get('id')) ? this.get('key') : this.get('id');
            return this.get('url') || '/overlay/' + pk + '.json';
        },

        initialize: function() {
            var model = this;
            this.getImageTileUrl = function(coord, zoom) {
                var normalizedCoord = getNormalizedCoord(coord, zoom);
                if (!normalizedCoord) { return null; }
                var url = fillTemplate(model.get('unalignedTilesUrl'), {
                    zoom: zoom,
                    x: normalizedCoord.x,
                    y: normalizedCoord.y
                });
                return url;
            };
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
            var tiepoint = this.get('points')[pointIndex] || [null,null,null,null];
            var coordIdx= {
                'map': [0,1],
                'image': [2,3],
            }[whichSide];
            assert(coordIdx, "Unexpected whichSide argument: "+whichSide);
            tiepoint[coordIdx[0]] = coords.x;
            tiepoint[coordIdx[1]] = coords.y;
            this.get('points')[pointIndex] = tiepoint;
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
