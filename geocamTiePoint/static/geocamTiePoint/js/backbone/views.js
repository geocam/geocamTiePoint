var app = app || {};

$( function( $ ) {
    
    app.View = Backbone.View.extend({
        el: null,
        template: null,
        render: function() {
            if (! this._renderedTemplate ) {
                this._renderedTemplate = Handlebars.compile(this.template);
            }
            var output = this._renderedTemplate(this.context);
            $(el).html(output);
            return output;
        },
    });

    app.AppView = app.View.extend({

        // Select a div to contain the entire backboney part of the app
        el: '#backbone_app_container',

        template:   '<div id="navbar"></div>' +
                    '<div id="map_canvas"></div>',


    
    });
});
