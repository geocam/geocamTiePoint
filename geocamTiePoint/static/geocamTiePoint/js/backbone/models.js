var app = app || {};
app.models = app.models || {};

// All these globals should be loaded from elsewhere.
assert(typeof getNormalizedCoord !== 'undefined', "Missing global: getNormalizedCoord");
assert(typeof getNormalizedCoord !== 'undefined', "Missing global: fillTemplate");
assert(typeof TILE_SIZE !== 'undefined', "Missing global: TILE_SIZE");
assert(typeof MIN_ZOOM_OFFSET !== 'undefined', "Missing global: MIN_ZOOM_OFFSET");

$( function($) {
    app.models.Overlay = Backbone.Model.extend({
        idAttribute: 'key', // Backend uses "key" as the primary key
        url: function(){ return this.get('url') || '/overlay/'+this.id+'.json' },

        initialize: function(){
            var model = this;
            this.getImageTileUrl = function(coord, zoom) {
                coord.y %= 1 << zoom;
                var normalizedCoord = getNormalizedCoord(coord, zoom);
                if (!normalizedCoord) { return null; }
                var url = fillTemplate(model.get('unalignedTilesUrl'), {
                    zoom: zoom,
                    x: normalizedCoord.x,
                    y: normalizedCoord.y,
                });
                return url;
            };

            window.maxZoom0G = this.maxZoom();
        },

        maxDimension: function(){
            var size = this.get('imageSize');
            return Math.max(size[0], size[1]);
        },

        maxZoom: function() {
            return Math.ceil( Math.log(this.maxDimension() / TILE_SIZE) / Math.log(2) ) + MIN_ZOOM_OFFSET
        },

    });

    app.OverlayCollection = Backbone.Collection.extend({
        model: app.models.Overlay,
        url: '/overlays.json',
    });

    app.overlays = new app.OverlayCollection();
});

/*
    maxDimensionG = Math.max(overlay.imageSize[0], overlay.imageSize[1]);
    maxZoom0G = Math.ceil(Math.log(maxDimensionG / TILE_SIZE) / Math.log(2)) +
        MIN_ZOOM_OFFSET;
*/
