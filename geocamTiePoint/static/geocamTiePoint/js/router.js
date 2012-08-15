App.router = Ember.Router.create({
    enableLogging: true,
    root: Ember.Route.extend({
	index: Ember.Route.extend({
	    route: '/',
	    redirectsTo: 'alignTiePoints'
	}),
	alignTiePoints: Ember.Route.extend({
	    route: '/:overlay',
	    connectOutlets: function(router, controller) {
		App.AlignTiePoints.setOverlay(controller.overlay);
		router.get('applicationController').connectOutlet('alignTiePoints', controller);
	    }
	})
    })
});