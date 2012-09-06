// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

if (! window.geocamTiePoint) { window.geocamTiePoint = {}; }

/* draggableOverlay.js exports the following symbols to the geocamTiePoint
 * namespace:
 *
 * geocamTiePoint.DraggableOverlay class
 *
 */

(function() {

    // helpful examples:
    //
    // http://code.google.com/p/overlay-tiler/source/browse/static/overlay.js
    // http://techylinguist.com/posts/2012/02/03/google-maps-overlay-js-coffeescript/

    function getCssMatrix(transform) {
        // returns the css matrix specification for the specified
        // transform. transform should be a 3 x 3 matrix that maps from
        // overlay pixel coordinates to draggable map DOM element pixel
        // coordinates.

        return ('matrix(' +
                [transform.values[0][0],
                 transform.values[1][0],
                 transform.values[0][1],
                 transform.values[1][1],
                 transform.values[0][2],
                 transform.values[1][2]] +
                ')');
    }

    function getMercatorToDivTransform(proj) {
        // returns a transform matrix that maps from EPSG:900913
        // spherical mercator coordinates to draggable map DOM element
        // pixel coordinates.

        // pick arbitrary coordinates as samples for linear fit
        var ne = new google.maps.LatLng(30, 30);
        var sw = new google.maps.LatLng(0, 0);

        var neDiv = proj.fromLatLngToDivPixel(ne);
        var swDiv = proj.fromLatLngToDivPixel(sw);
        var divSize = {
            x: neDiv.x - swDiv.x,
            y: neDiv.y - swDiv.y
        };

        var neMeters = latLonToMeters(ne);
        var swMeters = latLonToMeters(sw);
        var meterSize = {
            x: neMeters.x - swMeters.x,
            y: neMeters.y - swMeters.y
        };

        var scale = {
            x: (divSize.x / meterSize.x),
            y: (divSize.y / meterSize.y)
        };
        var translation = {
            x: (neDiv.x - neMeters.x * scale.x),
            y: (neDiv.y - neMeters.y * scale.y)
        };

        return new Matrix(3, 3,
                          [[scale.x, 0, translation.x],
                           [0, scale.y, translation.y],
                           [0, 0, 1]]);
    }

    var DraggableOverlay = function(imageUrl, alignTransform, opts) {
        var el = this.el_ = document.createElement('img');
        // el.style.width = el.style.height = '1px';
        el.onload = this.setup_.bind(this);
        el.src = imageUrl;
        el.style.position = 'absolute';
        el.style.webkitTransformOrigin = '0 0';
        el.style.opacity = '0.5';

        this.alignTransform = alignTransform;
        this.opts = opts;
    };

    DraggableOverlay.prototype = new google.maps.OverlayView;

    DraggableOverlay.prototype.setup_ = function() {
        if (!this.added_) {
            window.setTimeout(this.setup_.bind(this), 50);
            return;
        }

        this.getPanes().overlayImage.appendChild(this.el_);
        this.retriggerDom_('mousedown');
        this.retriggerDom_('mouseup');
    };

    var requestAnimFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;

    DraggableOverlay.prototype.draw = function() {
        if (!this.added_) {
            // not ready yet
            return;
        }
        requestAnimFrame(this.draw_.bind(this), this.el_);
    };

    DraggableOverlay.prototype.draw_ = function() {
        this.el_.style.webkitTransform = this.computeTransform_();
    };

    DraggableOverlay.prototype.computeTransform_ = function() {
        var mercatorToDivTransform =
            getMercatorToDivTransform(this.getProjection());
        var T = mercatorToDivTransform.multiply(this.alignTransform);
        return getCssMatrix(T);
    };

    DraggableOverlay.prototype.onAdd = function() {
        this.added_ = true;
    };

    DraggableOverlay.prototype.onRemove = function() {
        this.el_.parentNode.removeChild(this.el_);
    };

    DraggableOverlay.prototype.retriggerDom_ = function(eventName) {
        var that = this;
        this.el_.addEventListener(eventName, function(e) {
            google.maps.event.trigger(that, eventName, e);
        });
    };

    DraggableOverlay.prototype.changed = function() {
        google.maps.event.trigger(this, 'change');
        this.draw();
    };

    /**********************************************************************
     * EXPORTS
     **********************************************************************/

    geocamTiePoint.DraggableOverlay = DraggableOverlay;

})();
