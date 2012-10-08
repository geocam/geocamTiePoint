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
            this.on('before_warp', this.beforeWarp);
            this.on('change:exportUrl', function(){
                if ( this.exportPending && this.get('exportUrl') ) {
                    console.log('Export trigger.');
                }
            }, this);
            this.on('export_ready', function(){ console.log('Export Ready!'); } );
        },

        url: function() {
            var pk = _.isUndefined(this.get('id')) ? this.get('key') : this.get('id');
            return this.get('url') || '/overlay/' + pk + '.json';
        },

        getImageTileUrl: function(coord, zoom) {
            assert( this.get('unalignedTilesUrl'), "Overlay is missing an unalignedTilesUrl property.  Likely it does not have an unalignedQuadTree set on the backend.");
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
            var initial_length = points.length;
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
            if (points.length > initial_length) this.trigger( 'add_point' );
            this.trigger('change:points');  // Manually trigger this, because the value of model.points (an array reference) hasn't actually changed.
        },

        computeTransform: function() {
            // only operate on points that have all four values.
            var points = _.filter(this.get('points'), function(coords){return _.all(coords, _.identity);});
            if ( points.length <2 ) return false; // a minimum of two tiepoints are required to compute the transform
            this.set('transform', 
                points ? geocamTiePoint.transform.getTransform(points).toDict() : {type: '', matrix: []}
            );
        },

        save: function(attributes, options) {
            // Always compute transform on before save.
            this.computeTransform();
            return Backbone.Model.prototype.save.call(this, attributes, options);
        },

        beforeWarp: function() {
            this.unset('exportUrl'); // We have to clear this because this.fetch() won't.
        },

        warp: function(options) {
            // Save the overlay, then trigger a server-side warp.
            options = options || {};
            var model = this;
            var warpUrl = this.url().replace('.json', '/warp');
            saveOptions = {
                error: options.error || function(){},
                success: function() {
                    model.trigger('before_warp');
                    var jqXHR = $.post(warpUrl);
                    jqXHR.success(function(){
                        model.fetch({
                            success: function(){
                                if (options.success) options.success(); 
                                model.trigger('warp_success');
                            }
                        });
                    });
                    if (options.error) { jqXHR.error(options.error); }
                },
            };
            this.save({}, saveOptions);
        },

        startExport: function(options) {
            //this.unset('exportUrl');
            assert(! this.get('exportUrl'), "Model has an exportUrl already.");
            var request_url = this.get('url').replace('.json', '/generateExport');
            this.exportPending = true;
            var model = this;
            model.on('export_ready', function(){this.exportPending = false;}, this);
            $.post(request_url, '', function(){
                model.fetch({ success: function(){
                    model.trigger('export_ready'); 
                    if (options.success) options.success();
                } });
            }, 'json')
            .error(function(xhr, status, error){
                 this.exportPending = false;
                 if (options.error) options.error();
            });
            this.pollUntilExportComplete(model);
        },

        pollUntilExportComplete: function pollForExportComplete (model, timeout){
            if (!model.exportPending) return false;
            this.fetch();
            //var timeout = timeout ? 1.5 * timeout : 1000;
            var timeout = 10000;
            console.log("polling overlay: " + timeout);
            this.pollTimer = setTimeout(_.bind(pollForExportComplete, this), timeout, model, timeout);
        },



    });

    app.OverlayCollection = Backbone.Collection.extend({
        model: app.models.Overlay,
        url: '/overlays.json'
    });

    app.overlays = new app.OverlayCollection();
});
