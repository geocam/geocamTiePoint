var app = app || {};
app.models = app.models || {};

$( function($) {
    app.models.Overlay = Backbone.Model.extend({
        idAttribute: 'key', // Backend uses "key" as the primary key
        url: function(){ return this.get('url') || '/overlay/'+this.id+'.json' },
    });

    app.OverlayCollection = Backbone.Collection.extend({
        model: app.models.Overlay,
        url: '/overlays.json',
    });

    app.overlays = new app.OverlayCollection();
});
