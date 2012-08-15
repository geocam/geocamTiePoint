App.PlaceTiePointsHandlebars = '<div class="page-title">Overlay number: {{App.PlaceTiePoints.overlay}}</div><br><div class="action-buttons"><input type="button" value="Help"></input><input type="button" value="Add Tie Point"></input></div><br><div id="place-tie-points-map-canvas"></div><br><input type="button" value="Align Tie Points" {{action nextStep}}></input>';

App.PlaceTiePoints = Ember.Object.create({
    overlay: null, controller: null,
    setOverlay: function (overlay) {
	this.overlay = overlay;
    },
    setController: function(controller) {
	this.controller = controller;
    }
});

App.PlaceTiePointsController = Ember.Controller.extend();
App.PlaceTiePointsView = Ember.View.extend({
    template: Ember.Handlebars.compile(App.PlaceTiePointsHandlebars)
});
