App.PlacetiePointsHandlebars = '<div class="page-title">Overlay number: {{App.PlaceTiePoints.overlay}}</div>';

App.PlaceTiePoints = Ember.Object.create({
    overlay: null,
    setOverlay: function (overlay) {
	this.overlay = overlay;
    }
});

App.PlaceTiePointsController = Ember.Controller.extend();
App.AlignTiePointsview = Ember.Viewextend({
    template: Ember.Handlebars.compile(App.PlaceTiePointsHandlebars)
});