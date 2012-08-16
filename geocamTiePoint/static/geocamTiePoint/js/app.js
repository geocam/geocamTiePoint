/** Root geocamTiePoint Ember app object */
window.App = Ember.Application.create({
    rootElement: '#contents'
});

App.ApplicationController = Ember.Controller.extend();
App.ApplicationView = Ember.View.extend({
    template: Ember.Handlebars.compile('{{outlet}}')
});

