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


App.OverlayListView = Ember.View.extend({
    templateName: 'overlay_list',
    overlaysBinding: 'App.OverlayController.content',
});

App.OverlayListController = Em.ArrayController.extend({
    init: function() {
        this.set('content', App.store.findAll(App.Overlay));
    },
});

App.OverlayController = Em.ObjectController.extend();
App.OverlayView = Ember.View.extend({
    template:
        '<h1>This is an OverlayView ({{id}})</h1>'+
        '{{outlet}}',
});

App.OverlayAlignController = Em.ObjectController.extend({
    init: function() {
        this._super();
        this.currentOverlay = null;
    },
})
App.OverlayAlignView = Ember.View.extend({
    templateName: 'overlay_align',
    map_container_id: 'map_canvas',
    didInsertElement: function() {
        var overlay = App.get('currentOverlay');
        if (overlay.isLoaded ) {
            this._drawMap();
        } else {
            overlay.set('didLoad', this._drawMap);
        }
    },
    _drawMap: function() {
        var map_container = $('#map_canvas');
        var overlay = App.get('currentOverlay');
        var mapOptions = {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
        };
        map = new google.maps.Map(map_container[0], mapOptions);
        fitNamedBounds(overlay.get('bounds'));
        return this;
    },

});

//App.OverlayAlignController = Em.ObjectController.extend({});


/**************************
* Controllers
**************************/
App.ApplicationController = Em.Controller.extend();



