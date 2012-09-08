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
            assert( this.context || this.model.toJson(), "Could note find a a context for the template.");
            var output = this._renderedTemplate( this.context || this.model.toJson() );
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

            gmap.mapTypes.set('image-map', maputils.ImageMapType(this.model));
            gmap.setMapTypeId('image-map');
            this.gmap = gmap;
            this.drawMarkers();
        },

        drawMarkers: function() {
            var model = this.model;
            var gmap = this.gmap;
            _.each( this.model.get('points'), function(point, index){
                var pixelCoords = { x: point[2], y: point[3] };
                if ( ! _.any(_.values(pixelCoords), _.isNull ) ) {
                    var latLon = pixelsToLatLon( pixelCoords, model.maxZoom() );
                    //var marker = getLabeledImageMarker(latLon, index);
                    var marker = maputils.createLabeledMarker(latLon, ''+(index+1), gmap );
                }
            });
        },
    });



});
