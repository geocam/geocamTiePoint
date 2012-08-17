function latLonToMeters(latLon) {
    var mx = latLon.lng() * originShift / 180;
    var my = Math.log(Math.tan((90 + latLon.lat()) * Math.PI / 360)) /
        (Math.PI / 180);
    my = my * originShift / 180;
    return {x: mx,
            y: my};
}

function metersToLatLon(meters) {
    var lng = meters.x * 180 / originShift;
    var lat = meters.y * 180 / originShift;
    lat = ((Math.atan(Math.exp((lat * (Math.PI / 180)))) * 360) / Math.PI) - 90;
    var latLng = new google.maps.LatLng(lat, lng);
    return latLng;
}

function fitNamedBounds(b) {
    var bounds = (new google.maps.LatLngBounds
                  (new google.maps.LatLng(b.south, b.west),
                   new google.maps.LatLng(b.north, b.east)));
    map.fitBounds(bounds);
}
