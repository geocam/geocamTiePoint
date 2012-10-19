var app = app || {};

$(function($) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            'home': 'home',
            'overlays/': 'listOverlays',
            'overlays/new': 'newOverlay',
            'overlay/:overlay_id/export': 'exportOverlay',
            'overlay/:overlay_id': 'viewOverlay',
            'overlay/:overlay_id/edit': 'editOverlay',
            'overlay/:overlay_id/delete': 'deleteOverlay',
            '': 'root'
        },

        root: function() {
            this.navigate('home', {trigger: true});
        },

        home: function() {
            console.log('Routed to Home.');
            new app.views.HomeView().render();
        },

        listOverlays: function() {
            console.log('Routed to listOverlays.');
            var view = new app.views.ListOverlaysView();
            view.render();
        },

        viewOverlay: function(overlay_id) {
            console.log('Routed to viewOverlay for ' + overlay_id);
            var view = new app.views.MapView({id: overlay_id, readonly: true});
            view.render();
        },

        editOverlay: function(overlay_id) {
            console.log('Routed to editOverlay for ' + overlay_id);
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

        deleteOverlay: function(overlay_id) {
            console.log('Routed to deleteOverlay');
            var view = new app.views.DeleteOverlayView({id: overlay_id});
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

    //Keep the content container height in sync with the window
    $(window).resize(function(e){
        var container = $('#contents');
        container.height( $(window).height() - container.offset().top );
    }).resize();
});
