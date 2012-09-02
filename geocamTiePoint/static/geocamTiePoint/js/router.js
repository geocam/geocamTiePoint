App.Router = Ember.Router.extend({

    enableLogging: true,

    root: Ember.Route.extend({
        index: Ember.Route.extend({
            route: '/',
            redirectsTo: 'listOverlays',
        }),

        listOverlays: Ember.Route.extend({
            route: '/overlays/',
            alignOverlayAction: Em.Route.transitionTo('alignOverlay'),
            
            connectOutlets: function(router, controller) {
                router.get('applicationController').connectOutlet( {
                    /* Ember intends a magic name-to-controller-and-view mechanism,
                     * where you can give connectOutlet a name string and it will infer
                     * the correct controller instance and view class to use,
                     * but I haven't gotten it to work properly.  
                     * Luckily, there are overrides. --EBS
                    */ 
                    controller: App.OverlayController.create(),
                    viewClass: App.OverlaylistView,
                } );
            },
        }),

        alignOverlay: Ember.Route.extend({
            route: '/overlay/:overlay_key/align',
            serialize: function(router, context) {
                return {overlay_key: context.key}
            },
            deserialize: function(router, params) {
                return router.get('overlayController').getByKey(params.overlay_key);
            },
            connectOutlets: function(router, overlay) {
                console.log("context for overlayAlignController");
                console.log(overlay);
                router.get('applicationController').connectOutlet({
                    controller: router.get('overlayController'),
                    viewClass: App.OverlayAlignView,
                });
            },
        }),

        alignTiePoints: Ember.Route.extend({
            route: '/align/:overlay',
            connectOutlets: function(router, context) {
                var overlay_id = context.overlay;
                App.AlignTiePoints.setOverlay(context.overlay);
                (router
                     .get('applicationController')
                     .connectOutlet('alignTiePoints', context.overlay)
                 );
            },
        }),
        /*

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
