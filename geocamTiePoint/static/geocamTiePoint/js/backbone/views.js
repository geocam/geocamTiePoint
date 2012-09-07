var app = app || {};
app.views = {};
app.map = app.map || {}; //namespace for map helper stuff

$( function( $ ) {

    app.View = Backbone.View.extend({
        el: '#backbone_app_container', // views will render here another element is specified on instantiation.
        template: null,
        context: null,
        beforeRender: function() {}, // optional hook
        afterRender: function() {}, // optional hook
        render: function() {
            this.beforeRender();
            if (! this._renderedTemplate ) {
                this._renderedTemplate = Handlebars.compile(this.template);
            }
            var output = this._renderedTemplate(this.context);
            this.$el.html(output);
            this.afterRender();
            return this;
        },
    });

    app.views.AppView = app.View.extend({
        template:   '<div id="navbar"></div>' +
                    '<div id="mapfasten-splitpane"></div>',
    });

    app.views.ListOverlaysView = app.View.extend({
        template:   '<h1>Choose an overlay:</h1>'+
                    '{{debug}}'+
                    '<ul>'+
                    '{{#each overlays }}'+
                    '<li><a href="#overlay/{{key}}">{{name}}</a></li>'+
                    '{{/each}}'+
                    '</ul>',
        initialize: function() {
           app.View.prototype.initialize.apply(this, arguments);
           this.context = { overlays: app.overlays.toJSON() }
        },

    });

    app.views.ShowImageView = app.View.extend({
        template:   '<h1>{{name}}</h1>'+
                    '<div id="image_canvas"></div>',

        initialize: function(options) {
            app.View.prototype.initialize.apply(this, arguments);
            if ( this.id && !this.model) { this.model = app.overlays.get(this.id) };
            if (!this.model) { throw "Requires a model!" }
            this.context = this.model.toJSON();
        },

        afterRender: function() {
            //var gmap = gmaps.draw_image_gmap(this.$el.find('#image_canvas')[0], this.model);
            var gmap = app.gmap = new google.maps.Map(this.$el.find('#image_canvas')[0], {
                    zoom: MIN_ZOOM_OFFSET,
                    streetViewControl: false,
                    backgroundColor: 'rgb(0,0,0)',
                    mapTypeControl: false,
            });

            // initialize viewport to contain image
            var imageSize = this.model.get('imageSize');
            var w = imageSize[0];
            var h = imageSize[1];
            var maxZoom = this.model.maxZoom();
            var sw = pixelsToLatLon({x: 0, y: h}, maxZoom);
            var ne = pixelsToLatLon({x: w, y: 0}, maxZoom);
            gmap.fitBounds(new google.maps.LatLngBounds(sw, ne));

            gmap.mapTypes.set('image-map', app.map.ImageMapType(this.model));
            gmap.setMapTypeId('image-map');
        
        },
    });


    /*
     * Map helper stuff... cleaned up versions of code formally found in overlay-view.js
     * Probably this stuff should find a new home.
     * Depends upon constants defined in in coords.js.
    */
    app.map.ImageMapType = function(overlayModel) { 
        assert(typeof TILE_SIZE !== 'undefined', "Missing global: TILE_SIZE");
        assert(typeof MIN_ZOOM_OFFSET !== 'undefined', "Missing global: MIN_ZOOM_OFFSET");
        assert(typeof settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION !== 'undefined', "Missing setting: settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION");
        return new google.maps.ImageMapType({
            getTileUrl: overlayModel.getImageTileUrl,
            tileSize: new google.maps.Size(TILE_SIZE, TILE_SIZE),
            maxZoom: overlayModel.maxZoom() + settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION,
            minZoom: MIN_ZOOM_OFFSET,
            //radius: 1738000, // This is the radius of the moon.  Probably not relevant.
            name: 'image-map'
        });
    };

});
