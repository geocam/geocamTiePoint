App.router = Ember.Router.create({
    enableLogging: true,
    root: Ember.Route.extend({
	index: Ember.Route.extend({
	    route: '/',
	    redirectsTo: 'alignTiePoints'
	}),
	alignTiePoints: Ember.Route.extend({
	    route: '/:overlay_id',
	    connectOutlets: function(router, overlay_id) {
		router.get('applicationController').connectOutlet('alignTiePoints', overlay_id);
	    }
	})
    })
});