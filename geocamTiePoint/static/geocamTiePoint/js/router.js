App.Router = Ember.Router.extend({

    enableLogging: true,

    root: Ember.Route.extend({
        index: Ember.Route.extend({
            route: '/',
            redirectsTo: 'listOverlays',
        }),

        listOverlays: Ember.Route.extend({
            route: '/overlays/',
            showOverlayAction: Em.Route.transitionTo('showOverlay'),
            
            connectOutlets: function(router, controller) {
                router.get('applicationController').connectOutlet( {
                    /* Ember intends a magic name-to-controller-and-view mechanism,
                     * where you can give connectOutlet a name string and it will infer
                     * the correct controller instance and view class to use,
                     * but I haven't gotten it to work properly.  
                     * Luckily, there are overrides. --EBS
                    */ 
                    controller: App.get('OverlayListController').create(),
                    viewClass: App.get('OverlayListView'),
                    context: App.store.find(App.Overlay),
                } );
            },
        }),

        showOverlay: Ember.Route.extend({
            route: '/overlay/:overlay_key',
            serialize: function(router, context) {
                var hash = {overlay_key: context.get('_id')}
                Em.assert("serialize() was passed a context with no ID", !!hash.overlay_key);
                if (hash.overlay_key == null) {debugger;}
                return hash;
            },
            deserialize: function(router, params) {
                var overlay = App.store.find(App.Overlay, params.overlay_key);
                //router.get('overlayAlignController').set('currentOverlay', overlay);
                App.set('currentOverlay', overlay);
                return overlay;
            },
            connectOutlets: function(router, controller) {
                router.get('applicationController').connectOutlet('overlay');
            },
            initialState: 'align',
            align: Ember.Route.extend({
                route: '/align',
                connectOutlets: function(router, context) {
                    if (! context) {
                        context = router.get('overlayController.currentOverlay');
                    }
                    console.log("context for overlayAlignController");
                    console.log(context);
                    router.get('applicationController').connectOutlet({
                        controller: router.get('overlayAlignController'),
                        viewClass: App.get('OverlayAlignView'),
                        context: context,
                    });
                },
            }),

        }), // end showOverlay

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
