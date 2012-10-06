var app = app || {};

$(function($) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            'overlays/': 'listOverlays',
            'overlays/new': 'newOverlay',
            'overlay/:overlay_id/export': 'exportOverlay',
            'overlay/:overlay_id': 'showOverlay',
            '': 'root'
        },

        root: function() {
            this.navigate('overlays/', {trigger: true});
        },

        listOverlays: function() {
            console.log('Routed to listOverlays.');
            var view = new app.views.ListOverlaysView();
            view.render();
        },

        showOverlay: function(overlay_id) {
            console.log('Routed to showOverlay for ' + overlay_id);
            var view = new app.views.SplitOverlayView({id: overlay_id});
            view.render();
        },

        newOverlay: function() {
            console.log('Routed to newOveraly');
            var view = new app.views.NewOverlayView();
            view.render();
        },

        exportOverlay: function(overlay_id) {
            console.log('Routed to exportOverlay for ' + overlay_id);
            var view = new app.views.ExportOverlayView({id: overlay_id});
            view.render();
        },

        start: function() {
            Backbone.history.start();
        }
    });

    app.router = new AppRouter();
    //app.router.start();

    /* 
     * Support for undo/redo global functions
    */
    window.getState = function() {
        if (app.currentView && app.currentView.getState) return app.currentView.getState();
    };
    window.setState = function(state) {
        if (app.currentView && app.currentView.setState) return app.currentView.setState(state);
    };
});
