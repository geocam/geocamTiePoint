// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

function fitNamedBounds(b, map) {
    var bounds = (new google.maps.LatLngBounds
                  (new google.maps.LatLng(b.south, b.west),
                   new google.maps.LatLng(b.north, b.east)));
    map.fitBounds(bounds);
}

function fillTemplate(tmpl, fields) {
    var result = tmpl;
    $.each(fields, function(field, val) {
        var pattern = '[' + field.toUpperCase() + ']';
        result = result.replace(pattern, val);
    });
    return result;
}

// Convenient assertions.  Nice for debugging.
function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function() {
  return 'AssertException: ' + this.message;
};
function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}

if (window.Handlebars != undefined) {
    // helper for debugging handlebars templates.
    Handlebars.registerHelper('debug', function(optionalValue) {
        console.log('Current Context');
        console.log('====================');
        console.log(this);
        if (optionalValue) {
            console.log('Value');
            console.log('====================');
            console.log(optionalValue);
        }
    });
}

