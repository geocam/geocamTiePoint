App.AlignTiePointsHandlebars = '<div class="page-title">Overlay number: {{App.AlignTiePoints.overlay}}</div>';

App.AlignTiePoints = Ember.Object.create({
    overlay: null,
    setOverlay: function (overlay) {
	this.overlay = overlay;
    }
});
App.AlignTiePointsController = Ember.Controller.extend();
App.AlignTiePointsView = Ember.View.extend({
    template: Ember.Handlebars.compile(App.AlignTiePointsHandlebars)
});