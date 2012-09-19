var app = app || {};
app.views = {};
app.map = app.map || {}; //namespace for map helper stuff

$(function($) {

    app.container_id = '#backbone_app_container';

    app.views.View = Backbone.View.extend({
        // views will render here another element is specified on instantiation.
        el: app.container_id,
        template: null,
        context: null,
        beforeRender: function() {}, // optional hook
        afterRender: function() {}, // optional hook
        render: function() {
            this.beforeRender();
            if (! this._renderedTemplate) {
                this._renderedTemplate = Handlebars.compile(this.template);
            }
            assert(this.context || this.model.toJson(),
                   'Could note find a a context for the template.');
            var output = this._renderedTemplate(this.context ||
                                                this.model.toJson());
            this.$el.html(output);
            this.afterRender();
            if (this.el === $(app.container_id)[0]) {
                app.currentView = this;
            }
            return this;
        }
    });

    app.views.AppView = app.views.View.extend({
        template: '<div id="navbar"></div>' +
            '<div id="mapfasten-splitpane"></div>'
    });

    app.views.ListOverlaysView = app.views.View.extend({
        template: '<h1>Choose an overlay:</h1>' +
            '{{debug}}' +
            '<ul>' +
            '{{#each overlays }}' +
            '<li><a href="#overlay/{{key}}">{{name}}</a></li>' +
            '{{/each}}' +
            '</ul>',

        initialize: function() {
           app.views.View.prototype.initialize.apply(this, arguments);
           this.context = { overlays: app.overlays.toJSON() };
        }

    });


    /*
    * OverlayView: id-accepting base class for views that deal with a
    * single Overlay.
    */
    app.views.OverlayView = app.views.View.extend({
        initialize: function(options) {
            app.views.View.prototype.initialize.apply(this, arguments);
            if (this.id && !this.model) {
                this.model = app.overlays.get(this.id);
            }
            assert(this.model, 'Requires a model!');
            this.context = this.model.toJSON();
            this.markers = [];
        },

        initZoomHotkey: function() {
            var zoomFactor = 4;
            var originalZoom = null;
            var view = this;
            var zoomed = false;
            var mousePosition = null;
            var mouseDown = null;

            function enhance() {
                console.log('ENHANCE.');
                originalZoom = view.gmap.getZoom();
                var targetZoom = Math.max(originalZoom + zoomFactor,
                                          view.model.maxZoom());
                //var targetZoom = view.model.maxZoom();
                view.gmap.setZoom(targetZoom);
                view.gmap.panTo(mousePosition);
            }

            function unenhance() {
                view.gmap.setZoom(originalZoom);
            }

            google.maps.event.addListener(view.gmap, 'mousemove', function(e) {
                mousePosition = e.latLng;
            });

            google.maps.event.addListener(view.gmap, 'mouseout', function(e) {
                mousePosition = null;
            });
            google.maps.event.addListener(view.gmap, 'mousedown', function(e) {
                mouseDown = true;
            });
            google.maps.event.addListener(view.gmap, 'mouseup', function(e) {
                mouseDown = false;
            });

            $(window).keydown(function(e) {
                //console.log(e.which);
                if (mousePosition && ! mouseDown &&
                    e.which === 90 &&  // z key
                    ! zoomed) {
                    zoomed = true;
                    enhance();
                }
            });

            $(window).keyup(function(e) {
                //console.log(e.which);
                if (zoomed && e.which === 90) { // z key
                    unenhance();
                    zoomed = false;
                }
            });
        }
    });

    app.views.ImageQtreeView = app.views.OverlayView.extend({
        template: '<div id="image_canvas"></div>',

        afterRender: function() {
            app.gmap = new google.maps.Map(this.$('#image_canvas')[0], {
            //var gmap = app.gmap = new google.maps.Map(this.el, {
                    zoom: MIN_ZOOM_OFFSET,
                    streetViewControl: false,
                    backgroundColor: 'rgb(0, 0, 0)',
                    mapTypeControl: false
            });
            var gmap = app.gmap;

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
            //this.initZoomHotkey();
        },

        drawMarkers: function() {
            var model = this.model;
            var gmap = this.gmap;
            var markers = this.markers = [];
            _.each(this.model.get('points'), function(point, index) {
                var pixelCoords = { x: point[2], y: point[3] };
                if (! _.any(_.values(pixelCoords), _.isNull)) {
                    var latLon = pixelsToLatLon(pixelCoords, model.maxZoom());
                    //var marker = getLabeledImageMarker(latLon, index);
                    var marker = (maputils.createLabeledMarker
                                  (latLon, '' + (index + 1), gmap));
                    markers[index] = marker;
                }
            });
        }
    });


    app.views.MapView = app.views.OverlayView.extend({
        template: '<div id="map_canvas"></div>',

        initialize: function() {
            app.views.View.prototype.initialize.apply(this, arguments);
            if (this.id && !this.model) {
                this.model = app.overlays.get(this.id);
            }
            assert(this.model, 'Requires a model!');
            this.context = this.model.toJSON();
        },

        afterRender: function() {
            assert(! _.isUndefined(fitNamedBounds),
                   'Missing global function: fitNamedBounds');
            assert(! _.isUndefined(maputils.handleNoGeolocation),
                   'Missing global function: handleNoGeolocation');

            var mapOptions = {
                zoom: 6,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };

            var gmap = new google.maps.Map(this.$('#map_canvas')[0],
                                           mapOptions);
            //var gmap = new google.maps.Map(this.el, mapOptions);

            var overlay = this.model.toJSON();

            if (overlay.bounds) {
                fitNamedBounds(overlay.bounds, gmap);
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    var pos = new google.maps.LatLng(position.coords.latitude,
                                                     position.coords.longitude);
                    gmap.setCenter(pos);
                }, function() {
                    maputils.handleNoGeolocation(gmap, true);
                });
            } else {
                // browser doesn't support geolocation
                maputils.handleNoGeolocation(gmap, false);
            }
            //google.maps.event.addListener(gmap, 'click', handleMapClick);
            this.gmap = gmap;
            this.drawMarkers();
            //this.initZoomHotkey();
        },

        drawMarkers: function() {
            var model = this.model;
            var gmap = this.gmap;
            var markers = this.markers = [];
            _.each(this.model.get('points'), function(point, index) {
                var meterCoords = { x: point[0], y: point[1] };
                var latLon = metersToLatLon(meterCoords);
                if (! _.any(_.values(latLon), _.isNull)) {
                    var marker = (maputils.createLabeledMarker
                                  (latLon, '' + (index + 1), gmap));
                    markers[index] = marker;
                }
            });
        }
    });

    app.views.SplitOverlayView = app.views.OverlayView.extend({

        template: '<div id="zoom_controls">' +
            '<button id="zoom_100">100%</button>' +
            '<button id="zoom_fit">Fit Overlay</button>' +
            '</div>' +
            '<div id="split_container">' +
            '<div id="split_left"></div>' +
            '<div id="split_right"></div>' +
            '</div>',

        afterRender: function() {
            this.imageView = new app.views.ImageQtreeView({
                el: '#split_right',
                model: this.model
            }).render();
            this.mapView = new app.views.MapView({
                el: '#split_left',
                model: this.model
            }).render();
            this.$('#split_container').splitter({
                resizeToWidth: true
                //dock: 'leftDock'
            });
            this.initZoomButtons();
            this.initMarkerMouseHandlers();
        },

        zoomMaximum: function() {
            var offset = 8;
            //var tileSize = 256;
            var imageZoom = this.imageView.model.maxZoom();
            //var mapZoom = Math.ceil(Math.log( Math.max.apply({},
            //  this.model.get('imageSize') ) / TILE_SIZE, 2)) + offset;
            var mapZoom = imageZoom + offset;
            this.imageView.gmap.setZoom(imageZoom);
            this.mapView.gmap.setZoom(mapZoom);
            var isSelected = function(marker) {
                return marker.get('selected');
            };
            if (_.any(this.mapView.markers, isSelected) {
                var selected = _.find(this.mapView.markers, isSelected);
                var idx = _.indexOf(this.mapView.markers, selected);
                this.mapView.gmap.panTo(this.mapView.markers[idx].position);
                this.imageView.gmap.panTo(this.imageView.markers[idx].position);
            }
        },

        zoomFit: function() {
            this.imageView.gmap.fitBounds(this.model.imageBounds());
            this.mapView.gmap.fitBounds(this.model.mapBounds());
        },

        initZoomButtons: function() {
            var view = this;
            var zoomed = null;
            this.$('button#zoom_100').click(function() {
                zoomed = true;
                view.zoomMaximum();
            });
            this.$('button#zoom_fit').click(function() {
                zoomed = false;
                view.zoomFit();
            });
            $(document).keyup(function(e) {
                console.log('key detect: ' + e.which);
                if (e.which === 122 || e.which === 90) { // match z or Z
                    zoomed = !zoomed;
                    if (zoomed) {
                        view.zoomMaximum();
                    } else {
                        view.zoomFit();
                    }
                }
            });
        },

        initMarkerMouseHandlers: function() {
            var views = [this.imageView, this.mapView];
            /* Select one pair of markers at a time */
            _.each(views, function(view) {
                _.each(view.markers, function(marker, index) {
                    (google.maps.event.addListener
                     (marker, 'mousedown', function() {
                         _.each(views, function(_view) {
                             _.each(_view.markers, function(_marker, _index) {
                                 _marker.set('selected', _index === index);
                             });
                         });
                     }));
                });
            });
        }

    });

});
