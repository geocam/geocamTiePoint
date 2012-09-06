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
