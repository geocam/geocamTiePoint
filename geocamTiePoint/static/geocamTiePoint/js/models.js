
App.GeocamTiepointRESTAdapter = DS.RESTAdapter.extend({
    find: function(store, type, id) {
        var url = type.getURL.fmt(id);
        $.getJSON(url, function(data){
            store.load(type, id, data);
        });
    },
    findAll: function(store, type){
        var url = type.listURL;
        $.getJSON(url, function(data){
            store.loadMany(
                type,
                data.map( function(item) {return item.key} ), // list of IDs
                data
            );
        });
    },
});

App.store = DS.Store.create({
  revision: 4,
  //adapter: DS.RESTAdapter.create({ bulkCommit: false })
  adapter: App.GeocamTiepointRESTAdapter.create({ bulkCommit: false })
});


/*
 * The following transform gives the datastore the ability to use an 
 * arbitrary Javascript object as a Model attribute.
 * This may cause problems with reverse-bindings.
 * c.f. https://github.com/emberjs/data/pull/71
*/

DS.attr.transforms['object'] = {
    from: function (serialized) {
        return Em.none(serialized) ? null : serialized;
    },
    to: function(deserialized){
        return Em.none(deserialized) ? null : deserialized;
    },
};

DS.attr.transforms['timeISO'] = {
    from: function(serialized) {
        return new Date(Date.parse(serialized));
    },
    to: function(deserialized) {
        return typeof(deserialized) === 'string' ? deserialized : deserialized.toISOString();
    },
};


/*
 * MODELS
*/

App.Overlay = DS.Model.extend({
    //"bounds": DS.belongsTo( 'App.BoundsModel', {embedded: true} ),
    "key": DS.attr('number'), 
    "id": function(){ return this.get('key') }.property('key'),
    "name": DS.attr('string'), 
    "lastModifiedTime": DS.attr('timeISO'), 
    "bounds": DS.attr('object'),
    "imageSize": DS.attr('object'),
    "points": DS.attr('object'),
    "transform": DS.attr('object'), 
    "unalignedTilesUrl": DS.attr('string'), 
    "unalignedTilesZoomOffset": DS.attr('number'), 
    "url": DS.attr('string'),
    'primaryKey': 'key',
});

App.Overlay.reopenClass({
    // URL templates for REST API
    getURL: '/overlay/%@.json',
    listURL: '/overlays.json',

    'primaryKey': 'key',
});
