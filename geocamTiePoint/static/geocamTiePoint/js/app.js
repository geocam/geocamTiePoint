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



/**************************
* Controllers
**************************/
App.ApplicationController = Ember.Controller.extend();

App.OverlayListController = Ember.ArrayController.extend({
    content: [],
    init: function() {
        var me = this;
        $.getJSON('/overlays.json', function(data) {
            if ( me.content ) { me.set('content', []); }
            $.each(data, function(idx, item) {
                overlay = App.Overlay.create( item );
                me.pushObject(overlay);
            });
        });
    },
});

