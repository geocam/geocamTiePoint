/**************************
* Application
**************************/

/** Root geocamTiePoint Ember app object */
window.App = Ember.Application.create({
    rootElement: '#contents'
});

/**************************
* Models
**************************/

/*
App.Overlay = Ember.Object.extend({
    "bounds": null, 
    "imageSize": null,
    "key": null, 
    "lastModifiedTime": null, 
    "name": null, 
    "points": [], 
    "transform": null, 
    "unalignedTilesUrl": null,
    "unalignedTilesZoomOffset": 3, 
    "url": null
});
/*

/**************************
* Views
**************************/

App.ApplicationView = Ember.View.extend({
    templateName: "application",
});


App.OverlaylistView = Ember.View.extend({
    templateName: 'overlay_list',
    overlaysBinding: 'App.OverlayController.content',
});

App.OverlayAlignView = Ember.View.extend({
    templateName: 'overlay_align',
    map_container_id: 'map_canvas',
    didInsertElement: function() {
        var map_container = $('#'+this.map_container_id);
        var overlay = this.content;
        var mapOptions = {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
        };
        map = new google.maps.Map(map_container[0], mapOptions);
        fitNamedBounds(overlay.bounds);
    },

});


/**************************
* Controllers
**************************/
App.ApplicationController = Em.Controller.extend();

App.OverlayController = Em.ArrayController.extend({
    content: [],
    initialized: false,
    initializing: false,
    init: function() {
        var me = this;
        this.initializing = true;
        this.loadOverlays(function(){ 
            me.initialized = true; 
            console.log('overlayController initialized.');
        });
    },

    loadOverlays: function(callback) {
        $.getJSON('/overlays.json', function(data) {
            var me = this;
            if ( me.content ) { me.set('content', []); }
            $.each(data, function(idx, item) {
                overlay = App.Overlay.create( item );
                me.pushObject(overlay);
            });
            if (callback) { callback(); }
        });
    },
    getByKey: function(key) {
        if (! this.initialized) {
            if (! this.initializing ) { this.init() };
        }
        // Return the overlay from this collection matching the given key
        $.each( this.content, function(idx, overlay) {
            if (overlay.key === key) {
                return overlay;
            }
        });
    },
});

