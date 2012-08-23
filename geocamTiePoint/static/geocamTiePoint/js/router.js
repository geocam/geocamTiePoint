App.Router = Ember.Router.extend({

    enableLogging: true,

    root: Ember.Route.extend({
        index: Ember.Route.extend({
            route: '/',
            redirectsTo: 'listOverlays',
        }),

        listOverlays: Ember.Route.extend({
            route: '/overlays/',
            connectOutlets: function(router, controller) {
                router.get('applicationController').connectOutlet( {
                    controller: App.OverlayListController.create(),
                    viewClass: App.OverlaylistView,
                } );
            },
        }),

        /*
        alignTiePoints: Ember.Route.extend({
            route: '/align/:overlay',
            connectOutlets: function(router, controller) {

            App.AlignTiePoints.setOverlay(controller.overlay);
                (router
                 .get('applicationController')
                 .connectOutlet('alignTiePoints', controller));

            }
        }),

        placeTiePoints: Ember.Route.extend({
            route: '/place/:overlay',
            nextStep: function() {
                App.router.transitionTo('alignTiePoints',
                                        App.PlaceTiePoints.controller);

        },
            connectOutlets: function(router, controller) {
                App.PlaceTiePoints.setOverlay(controller.overlay);
                App.PlaceTiePoints.setController(controller);
                (router
                 .get('applicationController')
                 .connectOutlet('placeTiePoints', controller));

            }
        }),
        */
        }),

});
