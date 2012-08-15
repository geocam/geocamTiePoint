App.router = Ember.Router.create({
    root: Ember.Route.extend({
	index: Ember.Route.extend({
	    route: '/'
	}),
	alignTiePoints: Ember.Route.extend({
	    route: '/:overlay_id'
	})
    })
});