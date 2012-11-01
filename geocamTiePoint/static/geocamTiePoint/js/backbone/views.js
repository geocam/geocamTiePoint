var app = app || {};
app.views = {};
app.map = app.map || {}; //namespace for map helper stuff

$(function($) {

    app.container_id = '#backbone_app_container';

    /*
     * Handlebars helper that allows us to access
     * model instance attributes from within a template.
     * attr must be passed in as a (quoted) string literal from the template.
     */
    Handlebars.registerHelper('get', function(attr) {
        return this.get(attr);
    });
    Handlebars.registerHelper('nospecials', function(s) {
        return s.replace(/[^\w]/g, '_');
    });

    app.views.View = Backbone.View.extend({
        // views will render here unless another element is specified on
        // instantiation.
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

            /*
              assert(this.context || this.model.toJSON,
              'Could note find a a context for the template.');
            */
            if (! this.context && ! this.model) { this.context = {}; }
            var context;
            if (this.context) {
                context = (_.isFunction(this.context) ?
                           this.context() : this.context);
            } else {
                context = this.model.toJSON();
            }
            var output = this._renderedTemplate(context);
            this.$el.html(output);
            this.afterRender();
            if (this.el === $(app.container_id)[0]) {
                app.currentView = this;
            }
            return this;
        }
    });

    app.views.NavbarView = app.views.View.extend({
        template:
            '<div class="navbar-inner">' +
            '<ul id="navlist" class="nav">' +
            '<li><a href="/">' +
            '<img src="/static/mapFasten/icons/mapFastenLogo.png"/>' +
            '</a></li>' +
            '<li class="nav_pad_vertical navbar-text">' +
            '<a href="#overlays/">List Overlays</a></li>' +
            '</ul>' +
            '<p class="pull-right navbar-text" style="float:right">' +
            '<a href="/accounts/logout/">Logout</a></p>' +
            '</div>'
    });

    app.views.ListOverlaysView = app.views.View.extend({
        template:
        '<a class="btn btn-primary" href="#overlays/new">New Overlay</a>' +
            '<h1>Choose an overlay:</h1>' +
            '{{debug}}' +
            '<table id="overlay_list">' +
            '{{#each overlays.models }}<tr>' +
            '<td>{{#if attributes.alignedTilesUrl}}' +
            '<a href="#overlay/{{id}}">' +
            '{{/if}}' +
            '{{get "name"}}' +
            '{{#if attributes.alignedTilesUrl}}</a>{{/if}}</td>' +
            '<td><a id="edit_{{id}}" class="edit" ' +
            'href="#overlay/{{id}}/edit">' +
            '[edit]</a></td>' +
            '<td><a id="delete_{{id}}" class="delete" href="#overlays/"' +
            ' onClick="app.currentView.deleteOverlay({{id}})">' +
            '[delete]</a></td>' +
            '</tr>{{/each}}' +
            '</table>' +
            '<div class="modal hide" id="confirmDelete" aria-hidden="true">' +
                '<div class="modal-body">' +
                    '<p>Delete this overlay?</p>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="btn" ' +
                    'onClick="$(\'#confirmDelete\').modal(\'hide\');">' +
                    'No!</button>' +
                    '<button id="deleteYesBtn" class="btn btn-primary">' +
                    'Yes</button>' +
                '</div>' +
            '</div>',

        initialize: function() {
            app.views.View.prototype.initialize.apply(this, arguments);
            this.context = { overlays: app.overlays };
            app.overlays.on('remove', function() {this.render();}, this);
        },

        deleteOverlay: function(overlay_id) {
            var dialog = this.$('#confirmDelete');
            function deleteSpecificOverlay() {
                dialog.modal('hide');
                app.overlays.get(overlay_id).destroy();
            }
            dialog.on('click', '#deleteYesBtn', deleteSpecificOverlay);
            dialog.on('hidden', function() {
                dialog.off('click', '#deleteYesBtn', deleteSpecificOverlay);
                return true;
            });
            dialog.modal('show');
        }

        /*
          afterRender: function(){
          this.$('#overlay_list li a.delete').each(function(idx, a){
          a.click(function(evt){
          var overlay_id = parseInt(this.id.split('_').pop());
          app.overlys.get(overlay_id).destroy();
          });
          });
          },
        */

    });


    app.views.HomeView = app.views.ListOverlaysView;

    /*
     * OverlayView: id-accepting base class for views that deal with a
     * single Overlay.
     * Base class for both OverlayGoogleMapsView and SplitOverlayView
     */
    app.views.OverlayView = app.views.View.extend({
        initialize: function(options) {
            app.views.View.prototype.initialize.apply(this, arguments);
            if (this.id && !this.model) {
                this.model = app.overlays.get(this.id);
            }
            assert(this.model, 'Requires a model!');
        },

        getState: function() {
            return this.model.toJSON();
        },

        setState: function(state) {
            return this.model.set(state);
        }
    });


    /*
     * OverlayGoogleMapsView:
     * Base class for ImageQtreeView and MapView
     * Implements Google Maps and Marker initialization & management
     */
    app.views.OverlayGoogleMapsView = app.views.OverlayView.extend({

        initialize: function(options) {
            app.views.OverlayView.prototype.initialize.apply(this, arguments);
            this.markers = [];

            this.on('gmap_loaded', this.initGmapUIHandlers);
            this.model.on('change:points', this.drawMarkers, this);
        },

        updateTiepointFromMarker: function(index, marker) {
            assert(false, 'Override me in a subclass!');
        },

        _drawMarkers: function(latlons_in_gmap_space) {
            var model = this.model;
            var gmap = this.gmap;
            var selected_idx;
            // destroy existing markers, if they exist.
            while (this.markers && this.markers.length > 0) {
                var marker = this.markers.pop();
                if (marker.get('selected')) selected_idx = this.markers.length;
                marker.setMap(null);
            }
            var markers = this.markers = [];
            _.each(latlons_in_gmap_space, function(latLon, index) {
                if (! _.any(_.values(latLon), _.isNull)) {
                    var marker = (maputils
                                  .createLabeledMarker(latLon,
                                                       '' + (index + 1),
                                                       gmap));
                    if (index === selected_idx) marker.set('selected', true);
                    this.initMarkerDragHandlers(marker);
                    markers[index] = marker;
                }
            }, this);
            model.trigger('redraw_markers');
        },

        drawMarkers: function() {
            assert(false, 'Override me in a subclass!');
        },

        selectMarker: function(idx) {
            _.each(this.markers, function(marker, i) {
                marker.set('selected', i === idx);
            });
            app.currentView.trigger('change_selection');
        },

        getSelectedMarkerIndex: function() {
            var selected_idx = -1;
            _.each(this.markers, function(marker, i) {
                if (marker.get('selected')) {
                    selected_idx = i;
                    return true;
                }
            });
            return selected_idx;
        },

        handleClick: function(event) {
            if (!_.isUndefined(window.draggingG) && draggingG) return;
            assert(!_.isUndefined(window.actionPerformed),
                   'Missing global actionPerformed().  Check for undo.js');
            actionPerformed();
            var latLng = event.latLng;
            var coord = latLonToPixel(latLng);
            var index = this.markers.length;

            var marker = maputils.createLabeledMarker(latLng,
                                                      '' + (index + 1),
                                                      this.gmap);
            this.initMarkerDragHandlers(marker);

            this.markers.push(marker);
            this.updateTiepointFromMarker(index, marker);
            app.currentView.selectMarker(index);
        },

        initGmapUIHandlers: function() {
                if (! this.options.readonly) {
                    google.maps.event.addListener(this.gmap, 'click',
                                                  _.bind(this.handleClick,
                                                         this));
                }
        },

        initMarkerDragHandlers: function(marker) {
            var view = this;
            (google.maps.event.addListener
             (marker, 'dragstart', function(evt) {
                 window.draggingG = true;
                 view.trigger('dragstart');
             }));
            (google.maps.event.addListener
             (marker, 'dragend',
              _.bind(function(event) {
                  actionPerformed();
                  var index = this.markers.indexOf(marker);
                  assert(index >= 0, 'Marker not found.');
                  this.updateTiepointFromMarker(index, marker);
                  _.delay(function() {window.draggingG = false;}, 200);
              }, this)));
        }

    }); // end OverlayGoogleMapsView base class

    app.views.ImageQtreeView = app.views.OverlayGoogleMapsView.extend({
        template: '<div id="image_canvas"></div>',

        beforeRender: function() {
            // somebody set us up the global variable!
            window.maxZoom0G = this.model.maxZoom();
        },

        afterRender: function() {
            app.gmap = new google.maps.Map(this.$('#image_canvas')[0], {
                zoom: MIN_ZOOM_OFFSET,
                streetViewControl: false,
                backgroundColor: 'rgb(192, 192, 192)',
                mapTypeControl: false,
                draggableCursor: 'crosshair'
            });
            var gmap = app.gmap;

            // disable 45-degree imagery
            gmap.setTilt(0);

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
            (google.maps.event.addListenerOnce
             (this.gmap, 'idle', _.bind(function() {
                 this.drawMarkers();
                 this.trigger('gmap_loaded');
                 if (this.options.debug) this.debugInstrumentation.apply(this);
             }, this)));
        },

        debugInstrumentation: function() {
            var center = this.gmap.getCenter();
            var coords = [];
            coords.push([center.lat(), center.lng()]);
            for (var i = -180; i <= 180; i += 10) {
                coords.push([center.lat(), i]);
            }
            for (var i = -90; i <= 90; i += 10) {
                coords.push([i, center.lng()]);
            }
            var map = this.gmap;
            _.each(coords, function(coord) {
                var marker = new google.maps.Marker({
                    position: new google.maps.LatLng(coord[0], coord[1]),
                    title: coord.toString(),
                    map: map
                });
            });

            var positionBox = $('<div id="positionBox">' +
                '<div id="imagePos" "></div>' +
                '<div id="mapPos" </div>' +
            '</div>');
            $('#workflow_controls').before(positionBox);
            var imagePos = positionBox.find('#imagePos');
            var mapPos = positionBox.find('#mapPos');
            var transform = (geocamTiePoint.transform.deserializeTransform
                             (this.model.get('transform')));
            (google.maps.event.addListener
             (map, 'mousemove', function trackMouse(e) {
                 imagePos.text('image: ' + e.latLng.toString());
                 mapPos.text('map: ' +
                             forwardTransformLatLon(transform, e.latLng)
                             .toString());
             }));
        },

        drawMarkers: function() {
            var model = this.model;
            var latLons = [];
            _.each(this.model.get('points'), function(point, index) {
                var pixelCoords = { x: point[2], y: point[3] };
                if (! _.any(_.values(pixelCoords), _.isNull)) {
                    var latLon = pixelsToLatLon(pixelCoords, model.maxZoom());
                    latLons.push(latLon);
                }
            }, this);
            return this._drawMarkers(latLons);
        },

        updateTiepointFromMarker: function(index, marker) {
            var coords = latLonToPixel(marker.getPosition());
            this.model.updateTiepoint('image', index, coords);
        }

    }); // end ImageQtreeView


    app.views.MapView = app.views.OverlayGoogleMapsView.extend({
        template: '<div id="map_canvas"></div>',
        overlay_enabled: true,

        initialize: function(options) {
            (app.views.OverlayGoogleMapsView.prototype.initialize.apply
             (this, arguments));
            if (this.id && !this.model) {
                this.model = app.overlays.get(this.id);
            }
            assert(this.model, 'Requires a model!');
        },

        afterRender: function() {
            assert(! _.isUndefined(fitNamedBounds),
                   'Missing global function: fitNamedBounds');
            assert(! _.isUndefined(maputils.handleNoGeolocation),
                   'Missing global function: handleNoGeolocation');

            var mapOptions = {
                zoom: 6,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                draggableCursor: 'crosshair'
            };

            var gmap = new google.maps.Map(this.$('#map_canvas')[0],
                                           mapOptions);
            //var gmap = new google.maps.Map(this.el, mapOptions);

            // disable 45-degree imagery
            gmap.setTilt(0);

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
            this.gmap = gmap;
            if (! this.options.readonly) {
                this.drawMarkers();
            }
            this.trigger('gmap_loaded');

            /* Events and init for the  qtree overlay */
            this.model.on('change:points', function() {
                if (_.isUndefined(this.previousPoints) ||
                    ! _.isEqual(this.previousPoints,
                                this.model.get('points'))) {
                    // Serialize and deserialize to create a deep copy.
                    this.previousPoints = (JSON.parse
                                           (JSON.stringify
                                            (this.model.get('points'))));
                    this.destroyAlignedImageQtree();
                    if (this.model.get('points').length > 2) this.model.warp();
                }
            }, this);
            this.on('dragstart', this.destroyAlignedImageQtree, this);
            this.model.on('add_point', this.destroyAlignedImageQtree, this);
            this.model.on('warp_success', this.refreshAlignedImageQtree, this);
            if (this.model.get('transform') &&
                this.model.get('transform').type) {
                this.initAlignedImageQtree();
            }
        },

        initAlignedImageQtree: function() {
            var DEFAULT_OPACITY = 40;
            if (this.overlay_enabled && !this.alignedImageVisible) {
                this.alignedImageVisible = true;
                var mapType = new maputils.AlignedImageMapType(this.model);
                this.gmap.overlayMapTypes.insertAt(0, mapType);
                if (_.isUndefined(this.model.overlayOpacity)) {
                    this.model.overlayOpacity = DEFAULT_OPACITY;
                }
                maputils.createOpacityControl(this.gmap, mapType, this.model);
            }
        },

        destroyAlignedImageQtree: function() {
            if (this.alignedImageVisible) {
                this.gmap.overlayMapTypes.pop();
                this.gmap.controls[google.maps.ControlPosition.TOP_RIGHT].pop();
                this.alignedImageVisible = false;
            }
        },

        refreshAlignedImageQtree: function() {
            this.destroyAlignedImageQtree();
            this.initAlignedImageQtree();
        },

        drawMarkers: function() {
            var latLons = [];
            _.each(this.model.get('points'), function(point, index) {
                var meterCoords = { x: point[0], y: point[1] };
                if (! _.any(_.values(meterCoords), _.isNull)) {
                    var latLon = metersToLatLon(meterCoords);
                    latLons.push(latLon);
                }
            }, this);
            result = this._drawMarkers(latLons);
        },

        updateTiepointFromMarker: function(index, marker) {
            var coords = latLonToMeters(marker.getPosition());
            this.model.updateTiepoint('map', index, coords);
        }

    }); // end MapView

    app.views.SplitOverlayView = app.views.OverlayView.extend({

        helpSteps: [
            {
                promptText: 'Use "Go to Location" to zoom the map ' +
                    'to the neighborhood of your overlay.',
                videoId: 'sHp_OGcgckQ',
                helpFunc: function() {
                     this.$('#locationSearch').focus();
                     flicker(
                         function() {
                             (this.$('#locationSearch')
                              .css('background-color', '#aaf'));
                         },
                         function() {
                             (this.$('#locationSearch')
                              .css('background-color', '#fff'));
                         },
                         500, 8);
                }
            },
            {
                promptText: 'Click matching landmarks on both sides' +
                    ' to add tiepoints and align your overlay.',
                videoId: '95h45vkpxr8'
             },
            {
                promptText: 'Use "Share" to see options for viewing ' +
                    'your overlay in maps outside this site.',
                videoId: 'rgNW5Iaq1Dw',
                helpFunc: function() {
                     this.$('#export').focus();
                     flicker(
                         function() {
                             this.$('#export').addClass('btn-primary');
                         },
                         function() {
                             this.$('#export').removeClass('btn-primary');
                         },
                         500, 3);
                }
             }
        ],

        template:
        '<div id="location" class="btn-toolbar">' +
            '<span class="input-prepend">' +
                '<span class="add-on">Go to</span>' +
                '<input type="text" id="locationSearch" ' +
                'placeholder="Location"></input>' +
            '</span>' +
            '<span class="alert instructions-prompt">' +
                '<strong style="float:left; margin-right:1em;">Tips:</strong>' +
                '<div class="btn-group floatleft"' +
                    ' style="margin-right: 10px;">' +
                    '<a id="promptPrevStep" class="btn btn-mini">&lt;&lt;</a>' +
                    '<a id="promptNextStep" class="btn btn-mini">&gt;&gt;</a>' +
                '</div>' +
                '<span id="userPromptText">Add matching tiepoints on both' +
                ' sides to align your overlay.</span>' +
                '<button id="video" class="btn btn-mini">Video</button>' +
                '<a class="close" data-dismiss="alert">&times;</a>' +
            '</span>' +
        '</div>' +
        '<div id="workflow_controls" class="btn-toolbar">' +
            '<div class="btn-group">' +
                '<button class="btn" id="help"">Help</button>' +
            '</div>' +
            '<div class="btn-group">' +
                '<button class="btn" id="undo" onclick="undo()">Undo</button>' +
                '<button class="btn" id="redo" onclick="redo()">Redo</button>' +
                '<button class="btn" id="delete" disabled=true>' +
                'Delete</button>' +
            '</div>' +
            '<div id="zoom_group" class="btn-group" style="margin-left:10px">' +
                '<button class="btn" id="zoom_100">Zoom Max</button>' +
                '<button class="btn" id="zoom_fit">Zoom Fit</button>' +
            '</div>' +
                '<button class="btn"><label for="show_preview">' +
                   '<input id="show_preview" type="checkbox" ' +
                   'checked="true"/>Show Preview</label>' +
                '</button>' +
            '<div id="save-export" class="btn-group">' +
                '<button class="btn" id="export">Share</button>' +
                '<button class="btn" id="save">Save</button>' +
                '<span id="saveStatus" ' +
                  'data-saving-text="Saving..." ' +
                  'data-changed-text="Changed since last save" ' +
                  'data-saved-text="Saved." ' +
                  'data-server-error="Server Error" ' +
                  'data-server-unreachable="Server unreachable">' +
                '</span>' +
            '</div>' +
        '</div>' +
        '<div id="split_container">' +
            '<div id="split_left"></div>' +
            '<div id="split_right"></div>' +
        '</div>' +
        '<div id="helpText" class="modal hide">' +
            '<div class="modal-header">' +
                '<button type="button" class="close" ' +
                  'data-dismiss="modal" aria-hidden="true">&times;</button>' +
                '<h3>MapFasten Help</h3>' +
            '</div>' +
            '<div id="modalBody" class="modal-body"></div>' +
            '<div class="modal-footer">' +
                '<button id="helpCloseBtn">Okay</button>' +
            '</div>' +
        '</div>',

        beforeRender: function() {
            if (this.helpIndex == null) {
                if (this.model.get('alignedTilesUrl')) {
                    this.helpIndex = 1;
                } else {
                    this.helpIndex = 0;
                }
            }
        },

        afterRender: function() {
            $('#promptHelp').click(function() {
                $('#helpText').modal('show');
            });
            $('#helpCloseBtn').click(function() {
                $('#helpText').modal('hide');
            });
            this.imageView = new app.views.ImageQtreeView({
                el: '#split_right',
                model: this.model,
                debug: false
            }).render();
            this.mapView = new app.views.MapView({
                el: '#split_left',
                model: this.model
            }).render();

            var subviews = [this.mapView, this.imageView];
            this.$('#split_container').splitter({
                resizeToWidth: true,
                dock: 'right'
            }).bind('resize', function(evt) {
                // ensure Google Maps instances get resized when the
                // splitter moves.
                _.each(subviews, function(subview) {
                    google.maps.event.trigger(subview.gmap, 'resize');
                });
            });
            maputils.locationSearchBar('#locationSearch', this.mapView.gmap);
            this.initButtons();
            this.initWorkflowControls();
            this.initMarkerSelectHandlers();
            (this.model.on
             ('add_point redraw_markers', this.initMarkerSelectHandlers, this));

            this.renderHelp();
            this.animatePrompt();
            enableUndoButtons();
        },

        renderHelp: function() {
            var helpData = this.helpSteps[this.helpIndex];
            this.$('#userPromptText').html(helpData.promptText);
            //this.$('#modalBody').html(helpData[1]);
            var videoView = new app.views.HelpVideoView({
                el: this.$('#modalBody'),
                videoId: helpData.videoId,
                parentView: this
            });
            videoView.render();
            if (helpData.helpFunc) {
                _.bind(helpData.helpFunc, this)();
            }

            if (this.helpIndex == 0) {
                this.$('#promptPrevStep').attr('disabled', 'disabled');
            } else {
                this.$('#promptPrevStep').removeAttr('disabled');
            }
            if (this.helpIndex == this.helpSteps.length - 1) {
                this.$('#promptNextStep').attr('disabled', 'disabled');
            } else {
                this.$('#promptNextStep').removeAttr('disabled');
            }
        },

        animatePrompt: function() {
            var prompt = $('.instructions-prompt');
            var startProps = {
                position: 'relative',
                'z-index': 1000,
                top: '300px'
            };
            var endProps = {
                top: '0px',
                left: '0px'
            };
            prompt.css(startProps);
            prompt.animate(endProps, {
                duration: 1500,
                complete: function() { prompt.css('position', 'static'); }
            });
        },

        prevHelpStep: function() {
            if (this.helpIndex > 0) this.helpIndex--;
            this.renderHelp();
        },

        nextHelpStep: function() {
            if (this.helpIndex < this.helpSteps.length) this.helpIndex++;
            this.renderHelp();
        },

        zoomMaximum: function() {
            //var imageZoom = this.imageView.model.maxZoom();
            var imageZoom = (this.imageView.gmap.mapTypes
                             .get('image-map').maxZoom);
            (google.maps.event.addListenerOnce
             (this.imageView.gmap, 'bounds_changed',
              _.bind(this.matchImageZoom, this)));
            this.imageView.gmap.setZoom(imageZoom);

            var isSelected = function(marker) {
                return marker.get('selected');
            };
            if (_.any(this.mapView.markers, isSelected)) {
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

        matchImageZoom: function() {
            function logBounds(bounds) {
                console.log('SW: ' + bounds.getSouthWest().toString());
                console.log('NE: ' + bounds.getNorthEast().toString());
            }
            // transform the bounds of the image view into map space and
            // zoom/pan the map view to fit.
            var transform = (geocamTiePoint.transform.deserializeTransform
                             (this.model.get('transform')));
            var imageBounds = this.imageView.gmap.getBounds();
            var mapBounds = new google.maps.LatLngBounds();
            console.log('Image Bounds');
            logBounds(imageBounds);
            (mapBounds.extend
             (forwardTransformLatLon(transform, imageBounds.getSouthWest())));
            (mapBounds.extend
             (forwardTransformLatLon(transform, imageBounds.getNorthEast())));
            //console.log("Map Bounds");
            //logBounds(mapBounds);
            maputils.fitMapToBounds(this.mapView.gmap, mapBounds);
        },

        initButtons: function() {
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
                switch (e.which) {
                    // match z or Z
                    case 122:
                    case 90:
                        if (e.ctrlKey) { // todo: command-key support for os x
                            // ctrl-z: undo
                            undo();
                            break;
                        }
                        zoomed = !zoomed;
                        if (zoomed) {
                            view.zoomMaximum();
                        } else {
                            view.zoomFit();
                        }
                        break;
                    case 89: // y
                        if (e.ctrlKey) redo();
                    case 46: // delete
                    // TODO: make this work with backspace without
                    // triggering the default (prev page) behavior
                    //case 8: // backspace
                        $('button#delete').click();
                        break;
                    default:
                        return true;
                }
                e.preventDefault();
                return false;
            });

            this.$('button#help, button#video').click(function() {
                $('#helpText').modal('show');
            });
            this.$('#promptPrevStep').click(_.bind(this.prevHelpStep, this));
            this.$('#promptNextStep').click(_.bind(this.nextHelpStep, this));
        },

        initWorkflowControls: function() {
            var splitView = this;
            var overlay = this.model;

            // Don't allow the user to save the tiepoints until at least
            // two are defined.
            if (! overlay.get('points') || overlay.get('points').length < 2) {
                var save_button = $('button#save');
                save_button.attr('disabled', true);
                function observePoints() {
                    if (this.get('points').length >= 2) {
                        if (_.filter(this.get('points'),
                                     function(p) {
                                         return _.all(p, _.identity);
                                     }).length >= 2) {
                            save_button.attr('disabled', false);
                            this.off('change:points', observePoints);
                        }
                    }
                }
                overlay.on('change:points', observePoints, overlay);
            }

            $('button#save').click(function() {
                var button = $(this);
                button.data('original-text', button.text());
                overlay.warp({
                    success: function(model, response) {
                        $('input#show_preview').attr('checked', true).change();
                    }
                });
            });

            var saveStatus = $('#saveStatus');
            this.model.on('before_warp', function() {
                //saveStatus.text(saveStatus.data('saving-text'));
                (saveStatus.html
                 ('<img src="/static/geocamTiePoint/images/loading.gif">'));
            }).on('warp_success', function() {
                saveStatus.text(saveStatus.data('saved-text'));
            }).on('warp_server_error', function() {
                (saveStatus.html
                 ($('<span class="error">').text
                  (saveStatus.data('server-error'))));
            }).on('warp_server_unreachable', function() {
                (saveStatus.html
                 ($('<span class="error">').text
                  (saveStatus.data('server-unreachable'))));
            });

            $('button#export').click(function() {
                app.router.navigate('overlay/' + overlay.id + '/export',
                                    {trigger: true});
            });

            $('input#show_preview').change(function(evt) {
                if (this.checked) {
                    splitView.mapView.overlay_enabled = true;
                    splitView.mapView.initAlignedImageQtree();
                } else {
                    splitView.mapView.overlay_enabled = false;
                    splitView.mapView.destroyAlignedImageQtree();
                }
            });

            this.on('change_selection', function() {
                var selectedMarkers = this.selectedMarkers();
                var markerSelected = _.any(selectedMarkers, function(i) {
                    return i > -1;
                });
                $('button#delete').attr('disabled', !markerSelected);
            });
            $('button#delete').click(function() {
                var views = [splitView.mapView, splitView.imageView];
                var selected = _.map(views, function(v) {
                    return v.getSelectedMarkerIndex();
                });
                selected = _.filter(selected, function(s) {return s >= 0});
                if (selected.length === 0) {
                    return false;
                } else if (selected.length === 2) {
                    assert(selected[0] === selected[1],
                           'Selected markers do not match.');
                }
                selected = selected[0];
                overlay.deleteTiepoint(selected);
                _.each(views, function(v) { v.selectMarker(null); });
                overlay.trigger('redraw_markers');
            });
        },

        initMarkerSelectHandlers: function() {

            /* Clear any extant select handlers, lest they get duplicated */
            var selectHandlers =
                this._selectHandlers =
                this._selectHandlers || [];
            while (selectHandlers.length > 0) {
                google.maps.event.removeListener(selectHandlers.pop());
            }

            var splitView = this;
            var views = [this.imageView, this.mapView];
            /* Select one pair of markers at a time */
            _.each(views, function(view) {
                _.each(view.markers, function(marker, index) {
                    selectHandlers.push(
                        google.maps.event.addListener(
                            marker, 'mousedown', function() {
                                splitView.selectMarker(index);
                            }
                        )
                    );
                });
            });
        },

        selectedMarkers: function() {
            var views = [this.mapView, this.imageView];
            return _.map(views, function(v) {
                return v.getSelectedMarkerIndex();
            });
        },

        selectMarker: function(index) {
            var views = [this.mapView, this.imageView];
            _.each(views, function(view) {
                view.selectMarker(index);
            });
        }

    }); // end SplitOverlayView

    app.views.HelpVideoView = app.views.View.extend({

        template:
          '<div id="helpVideo">' +
            '<div class="btn-group floatleft" style="margin-right: 10px;">' +
              '<a id="helpPrev" class="btn btn-mini" ' +
                '{{#if first}}disabled="true"{{/if}} >&lt;&lt;</a>' +
              '<a id="helpNext" class="btn btn-mini" ' +
                '{{#if last}}disabled="true"{{/if}}>&gt;&gt;</a>' +
            '</div>' +
            '<embed id="videoEmbed" width="560" height="315" ' +
              'src="http://www.youtube.com/v/' +
              '{{videoId}}?version=3&enablejsapi=1">' +
            '</embed>' +
            '<div class="videoCaption">{{captionText}}</div>' +
          '</div>',

        initialize: function(options) {
            var parentView = options.parentView;
            this.context = {
              videoId: options.videoId,
              captionText: options.captionText,
              first: parentView.helpIndex == 0,
              last: (parentView.helpIndex ==
                     (parentView.helpSteps.length - 1))
            };
        },

        afterRender: function() {
            var modal = this.$el.parent('.modal');
            var thisview = this;

            modal.off('.video_help');
            modal.on('hide.video_help', function() {
                var video = $(this).find('#videoEmbed');
                // TODO: fix this so that the video doesn't have to
                //reload if you open the help multiple times
                //video[0].pauseVideo();
                video.remove();
            });
            modal.on('shown.video_help', function() {
                thisview.render();
            });
            (this.$('#helpPrev').click
             (_.bind(this.options.parentView.prevHelpStep,
                     this.options.parentView)));
            (this.$('#helpNext').click
             (_.bind(this.options.parentView.nextHelpStep,
                     this.options.parentView)));
        }

    });

    // FIX: requirements text hard-coded, should auto-update based on settings
    var importRequirementsText =
        '[Size < 2 MB. Acceptable formats: JPEG, PDF, PNG, and others]';

    app.views.NewOverlayView = app.views.View.extend({

        template:
        '<div id="new_overlay_view">' +
            '<h3>Create a New Overlay: Import Overlay Image</h3>' +
            '<ul class="nav nav-tabs" id="formTabs">' +
            '  <li class="active" data-target="#fileUpload"><a href="#fileUpload">Upload</a></li>' +
            '  <li data-target="#urlSubmit"><a href="#urlSubmit">From a URL</a></li>' +
            '</ul>' +
            ' ' +
            '<div class="tab-content">' +
                '<div class="tab-pane active" id="fileUpload">' +
                    '<form encytype="multipart/form-data" id="overlayUploadForm">' +
                    '<div id="uploadControlGroup" class="control-group">' +
                        '<label>Choose an image to upload' +
                        '<span class="import-requirements">' + importRequirementsText + '</span>' +
                        '</label>' +
                        '<div><input type="file" name="file" id="newOverlayFile" /></div>' +
                        '<input class="btn newOverlayFormSubmitButton" type="button" value="Upload" />' +
                        window.csrf_token +
                    '</div>' +
                    '</form>' +
                '</div>' +
                '<div class="tab-pane" id="urlSubmit">' +
                    '<form encytype="multipart/form-data" id="overlayUrlForm">' +
                    '<div id="uploadControlGroup" class="control-group">' +
                        '<label>Image URL' +
                        '<span class="import-requirements">' + importRequirementsText + '</span>' +
                        '</label>' +
                        '<input type="text" id="imageUrl" style="width: 98%"/>' +
                        '<input class="btn newOverlayFormSubmitButton" type="button" value="Submit" />' +
                        window.csrf_token +
                    '</div>' +
                    '</form>' +
                '</div>' +
            '</div>' +
            '<div id="formErrorContainer"></div>' +
        '</div>',

        initialize: function() {
            app.views.View.prototype.initialize.apply(this, arguments);
            this.context = { overlays: app.overlays.toJSON() };
        },

        afterRender: function() {
            this.$('input.newOverlayFormSubmitButton').click(this.submitForm);
            that = this;
            /*this.$('#urlForm input#submitUrl').click(function(){
              $.post('/overlays/new.json', that.$('urlForm').serialize(), that.submitSuccess);
              });*/
            $('#formTabs a:first').tab('show');
            this.$('ul#formTabs a').click( function(e){
                e.preventDefault();
                $(this).tab('show');
            } );
        },

        getCookie: function(name) {
            var cookieValue = null;
            if (document.cookie && document.cookie != '') {
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = $.trim(cookies[i]);
                    if (cookie.substring(0, name.length + 1) == (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        },

        csrfSafeMethod: function(method) {
            return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
        },

        submitForm: function() {
            var button = $(this);
            var form = button.parents('form');
            button.data('value', button[0].value);
            button[0].value = "Working...";
            button[0].disabled = true;
            setTimeout(function(){
                if (button[0].value == "Working...") button[0].disabled = false;
            }, 10000);
            var data = new FormData();
            form.find('input#newOverlayFile').each(function(i, el){
                $.each(el.files, function(i, file) {
                    data.append('image', file);
                });
            });
	        if (form.find('input#imageUrl').val()) data.append('imageUrl', form.find('input#imageUrl')[0].value);
            var csrftoken = app.views.NewOverlayView.prototype.getCookie('csrftoken');
            $.ajax({
                url: '/overlays/new.json',
                crossDomain: false,
                beforeSend: function(xhr, settings) {
                    if (!app.views.NewOverlayView.prototype.csrfSafeMethod(settings.type)) {
                        xhr.setRequestHeader("X-CSRFToken", csrftoken);
                    }
                },
                data: data,
                cache: false,
                contentType: false,
                processData: false,
                type: 'POST',
                success: _.bind(app.views.NewOverlayView.prototype.submitSuccess, this),
                error: _.bind(app.views.NewOverlayView.prototype.submitError, this),
            });
        },

        submitError: function(xhr, status, errorThrown) {
            console.log("Error occured when trying to submit new overlay");
            var button = $(this);
            var errors;
            if (xhr.status == 400) {
                errors = JSON.parse(xhr.responseText);
            } else {
                errors = {'__all__': xhr.errorThrown}; // similar to the Django Forms ErrorDict
            }
            var errorDiv = $('#formErrorContainer').html('');
            var messages = _.flatten( _.values(errors) );  // for now, just flatten all the global and field specific error messages into a list
            _.each( messages, function(message) {
                var errorElem = $('<div/>').addClass('error').text(message);
                errorDiv.append(errorElem);
            });
            button[0].value = button.data('value');
            button[0].disabled = false;
        },

        submitSuccess: function(data) {
            console.log("got data back");
            var button = $(this);
            button[0].disabled = false;
            button[0].value = button.data('value');
            try {
                var json = JSON.parse(data);
            } catch (error) {
                console.log('Failed to parse response as JSON: ' + error.message);
                return;
            }
            if (json['status'] == 'success') {
                var overlay = new app.models.Overlay({key: json.id});
                app.overlays.add(overlay);
                overlay.fetch({ 'success': function() {
                    app.router.navigate('overlay/'+json['id']+'/edit', {trigger: true});
                } });
            }
        }
    }); // end NewOverlayView

    app.views.DeleteOverlayView = app.views.View.extend({

        template: '<form id="deleteOverlayForm"><h4>Are you sure you want to delete overlay {{name}}?</h4><br><input type="button" value="Delete" id="deleteOverlayFormSubmitButton" /><input type="button" value="Cancel" id="deleteOverlayFormCancelButton" />',

        initialize: function() {
            app.views.View.prototype.initialize.apply(this, arguments);
            if (this.id && !this.model) {
                this.model = app.overlays.get(this.id);
            }
            assert(this.model, 'Requires a model!');
            this.context = this.model.toJSON();
        },

        afterRender: function() {
            this.$('input#deleteOverlayFormSubmitButton').click(this.submitForm);
            this.$('input#deleteOverlayFormCancelButton').click(this.cancel);
        },

        cancel: function() {
            app.router.navigate('overlays/');
        },

        submitForm: function() {
            var key = this.context['key']
            $.ajax({
                url: '/overlay/'+key+'/delete.html',
                crossDomain: false,
                cache: false,
                contentType: false,
                processData: false,
                type: 'POST',
                success: app.views.DeleteOverlayView.prototype.submitSuccess
            });
        },

        submitSuccess: function(data) {
            console.log("got data back");
            app.router.navigate('overlays/');
        },
    }); // end DeleteOverlayView


    app.views.ExportOverlayView = app.views.OverlayView.extend({

        initialize: function() {
            app.views.OverlayView.prototype.initialize.apply(this, arguments);
            _.bindAll(this);
        },

        template:   '<h1>Share Overlay {{name}}</h1>'+
            '{{#if alignedTilesUrl}}' +
            '<div id="simple_viewer">' +
            '<a href="/overlay/{{key}}/simpleViewer_{{nospecials name}}.html" target="simpleViewer">' +
            'View a web page displaying your aligned overlay that you can download and serve from your web site' +
            '</a></div>' +
            '{{/if}}' +
            '{{#if exportUrl}}'+
            '<div id="download_link">'+
            '<a href="{{exportUrl}}">Download Exported Archive</a>'+
            '</div>'+
            '{{else}}'+
            '<div id="export_controls">' +
            '{{#if alignedTilesUrl}}' +
            '<div id="export_container">' +
            '<span id="export_button"><button id="create_archive">' +
            'Create Export Archive (this could take a few minutes)' +
            '</button></span>' +
            '<span id="exportError" style="color:red"></span>' +
            '</div>' +
            '{{else}}' +
            '<p>Add at least 2 tiepoint pairs before exporting the aligned image.</p>' +
            '{{/if}}' +
            '</div>' +
            '{{/if}}',

        afterRender: function(){
            this.$('#create_archive').click( _.bind(this.requestExport, this) );
            if( this.model.exportPending ) {
                this.startSpinner();
            }
        },

        requestExport: function(){
            //this.model.unset('exportUrl');
            this.$('#create_archive').attr('disabled', true);
            this.model.startExport({
                error: function(){
                    $('#exportError').html('Error during export: ' + error);
                },
            });
            this.startSpinner();
        },

        startSpinner: function(){
            thisView = this;
            this.model.on('export_ready', function onExportReady(){
                this.model.off(null, onExportReady, null);
                if ( app.currentView === thisView ) this.render();
            }, this);
            this.$('#create_archive').attr('disabled', true);
            this.$('#export_button').html('<img src="/static/geocamTiePoint/images/loading.gif">' +
                                          '&nbsp;' +
                                          'Creating export archive (this could take a few minutes)...');
        },

    }); //end ExportOverlayView
}); // end jQuery ready handler
