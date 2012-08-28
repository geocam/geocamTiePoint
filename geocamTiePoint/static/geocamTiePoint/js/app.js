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
});


