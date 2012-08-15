App.AlignTiePointsHandlebars = "";

App.AlignTiePoints = {
    // empty class in case we need functions specific to this view
};
App.AlignTiePointsController = Ember.Controller.extend();
App.AlignTiePointsView = Ember.View.extend({
    template: Ember.Handlebars.compile(App.AlignTiePointsHandlebars)
});