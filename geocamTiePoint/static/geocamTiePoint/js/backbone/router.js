var app = app || {};

$(function ($) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            '/overlays/': 'listOverlays',
            '/overlay/:overlay_id': 'showOverlay',
        },
        
        listOverlays: function() {
            console.log('listOverlays called.')
        },
        
        showOverlay: function(overlay_id) {
            console.log('showOverlay called for ' + overlay_id);
        },

    });

    app.router = new AppRouter();
    Backbone.history.start();
    
});
