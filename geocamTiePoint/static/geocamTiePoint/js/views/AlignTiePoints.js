App.alignTiePointsContainerView = Ember.ContainerView.create({
    childViews: [],
}).appendTo('body');



App.title = Ember.View.create({
  template: Ember.Handlebars.compile('Mountain View Topo: Align Tie Points'),
	
	classNameBindings: ['title'],
  attributeBindings: ['style'],
  style: 'weight: bold;',
});

App.controls = Ember.View.create({
  template: Ember.Handlebars.compile('<div style="float: left"><button {{action help target="App.alignTiePointsController"}}>Help</button>\
																			<input value="Place Search"></input><button>Go</button>\
																			<button id="start_aligning">Start Aligning Overlay Here</button></div>\
																			<div id="opacity" style="float: left;"></div>\
																			'),
	
	classNameBindings: ['controls'],
  attributeBindings: ['style'],
  style: 'width: 1000px;',
});

App.map = Ember.View.create({
  template: Ember.Handlebars.compile('<div id="align_map_preview" style="width:100%; height:100%;"></div>'),
	classNameBindings: ['align_map_preview'],
  attributeBindings: ['style'],
  style: 'height:400px; width:600px; margin: 0;',
	didInsertElement : function() {
			this._super();
      App.alignTiePointsController.insertMap();
  				
        
	}
});

App.alignTiePointsContainerView.get('childViews').pushObject(App.title);
App.alignTiePointsContainerView.get('childViews').pushObject(App.controls);
App.alignTiePointsContainerView.get('childViews').pushObject(App.map);





App.alignTiePointsController = Em.ObjectController.create({
	content: Em.A([]),
	overlay: null,
	map: null,
	markers: [],
	insertMap: function(){
			
      var latlng = new google.maps.LatLng(37.388163, -122.082138);
			// Creating an object literal containing the properties we want to pass to the map
			var options = {
		 		zoom: 6,
		  	center: latlng,
		  	mapTypeId: google.maps.MapTypeId.ROADMAP
			}; 
			// Calling the constructor, thereby initializing the map
			var map = new google.maps.Map(document.getElementById("align_map_preview"), options);
			this.map = map;

			this.addDragAndDrop(map);
	},
	help: function(){
		console.log('runs when you press help button');
	},


	setOverlay: function(){
  this.set('overlay', overlay);
  this.bindTo('map', overlay);
	
  /**
   * @type {Array.<google.maps.Marker>}
   */
  this.markers_ = [
    this.addGCPControl_('topLeft'),
    this.addGCPControl_('topRight'),
    this.addGCPControl_('bottomRight')
  ];

  var mover = this.addMover_();
  this.handleTranslate_();
	},
	

	addDragAndDrop: function(map){
		var drop = document.querySelector("#align_map_preview");

		drop.addEventListener('dragenter', this.stopEvent, false);
		drop.addEventListener('dragexit', this.stopEvent, false);
		drop.addEventListener('dragover', this.stopEvent, false);

	drop.addEventListener('drop', this.stopEvent, false);
		drop.addEventListener('drop', function(e) {

		  App.alignTiePointsController.stopEvent(e);

		  var files = e.dataTransfer.files;
		  if (!files.length) {
		    window.alert('No file uploaded');
		    return;
		  }
		  var imageURL = (window.URL || window.webkitURL).createObjectURL(files[0]);

		  var rect = map.getDiv().getBoundingClientRect();
		  var x = e.pageX - rect.left;
		  var y = e.pageY - rect.top;
		  var overlay = new Overlay(imageURL, x, y);

		//  map.controls[google.maps.ControlPosition.TOP_RIGHT].push( new OpacityWidget(overlay));
			document.getElementById("opacity").appendChild(new OpacityWidget(overlay));
			
		  overlay.setMap(map);

		  var editor = new OverlayEditor(overlay);

		//  uploadInBackground(files[0], map, overlay);
		}, false);
	
	},
	stopEvent: function(e) {
  e.stopPropagation();
  e.preventDefault();
	},
	
});

//--------------------------------------------------------------------------------

function Overlay(src, x, y) {
  var el = this.el_ = document.createElement('img');
  el.style.width = el.style.height = '1px';
  el.onload = this.setup_.bind(this);
  el.src = src;
  el.style.position = 'absolute';
  el.style.webkitTransformOrigin = '0 0';

  this.start_ = new google.maps.Point(x, y);
}



Overlay.prototype = new google.maps.OverlayView;

/**
 * @const
 */
Overlay.MAX_DIMENSION_ = 800;

/**
 * Resize the target image
 * @param {number} maxDimension the maximum width of the generated image.
 * @private
 */
Overlay.prototype.resize_ = function(maxDimension) {
  var el = this.el_;

  var canvas = document.createElement('canvas');
  canvas.width = maxDimension;
  canvas.height = canvas.width / this.aspectRatio_;

  var ctx = canvas.getContext('2d');
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

  el.src = canvas.toDataURL();
};

/**
 * @inheritDoc
 */
Overlay.prototype.onAdd = function() {
  this.added_ = true;
};

/**
 * Sets up the Overlay with initial ground control points and adds the overlay
 * to the map pane.
 * @private
 */
Overlay.prototype.setup_ = function() {
  if (!this.added_) {
    window.setTimeout(this.setup_.bind(this), 50);
    return;
  }

  this.aspectRatio_ = this.el_.naturalWidth / this.el_.naturalHeight;
  var maxPixels = Overlay.MAX_DIMENSION_ * Overlay.MAX_DIMENSION_;
  if (this.el_.naturalWidth * this.el_.naturalHeight > maxPixels) {
    this.resize_(Overlay.MAX_DIMENSION_);
  }
  this.getPanes().overlayImage.appendChild(this.el_);
  this.setInitialGCP_(this.start_);

  this.retriggerDom_('mousedown');
  this.retriggerDom_('mouseup');
};

/**
 * @inheritDoc
 */
Overlay.prototype.draw = function() {
  if (!this.added_) {
    // not ready yet
    return;
  }
  requestAnimFrame(this.draw_.bind(this), this.el_);
};

/**
 * Modifies the overlay's warping dependent on the control points.
 * @private
 */
Overlay.prototype.draw_ = function() {
  this.el_.style.webkitTransform = this.computeTransform_();
};

/**
 * @inheritDoc
 */
Overlay.prototype.onRemove = function() {
  this.el_.parentNode.removeChild(this.el_);
};

/**
 * Sets up the initial positioning of the overlay.
 *
 * @param {google.maps.Point} tl the top-left point to position the overlay,
 * relative within the Map container.
 * @private
 */
Overlay.prototype.setInitialGCP_ = function(tl) {
  var proj = this.getProjection();

  // TODO(cbro): figure out something potentially more appropriate.
  var width = 100;
  var height = width / this.aspectRatio_;

  var tr = new google.maps.Point(tl.x + width, tl.y);
  var br = new google.maps.Point(tl.x + width, tl.y + height);

  this.set('topLeft', proj.fromContainerPixelToLatLng(tl));
  this.set('topRight', proj.fromContainerPixelToLatLng(tr));
  this.set('bottomRight', proj.fromContainerPixelToLatLng(br));
};

/**
 * Listens for DOM events and re-fires them.
 *
 * @param {string} eventName DOM event name.
 */
Overlay.prototype.retriggerDom_ = function(eventName) {
  var that = this;
  this.el_.addEventListener(eventName, function(e) {
    google.maps.event.trigger(that, eventName, e);
  });
};

Overlay.prototype.changed = function() {
  google.maps.event.trigger(this, 'change');
  this.draw();
};

/**
 * Computes CSS affine transformation matrix.
 *
 * @return {string} suitable value for -webkit-transform.
 * @private
 */
Overlay.prototype.computeTransform_ = function() {
  var proj = this.getProjection();

  var tl = proj.fromLatLngToDivPixel(this.get('topLeft'));
  var tr = proj.fromLatLngToDivPixel(this.get('topRight'));
  var br = proj.fromLatLngToDivPixel(this.get('bottomRight'));
	if(tl == null)
		return 'matix(-1, -1, -1, -1, -1)';
  return 'matrix(' +
      [tr.x - tl.x, tr.y - tl.y, br.x - tr.x, br.y - tr.y, tl.x, tl.y] + ')';
};

/**
 * Sets the opacity of the image.
 *
 * @param {number} opacity the opacity, between 0 and 1.
 */
Overlay.prototype.setOpacity = function(opacity) {
  this.el_.style.opacity = opacity + '';
};

/**
 * Sets the unique Overlay key provided by the server.
 *
 * @param {string} key
 */
Overlay.prototype.setKey = function(key) {
  this.set('key', key);
};

/**
 * @return {string}
 */
Overlay.prototype.getKey = function() {
  return this.get('key');
};

//------------------------------------------------------------------
function OpacityWidget(overlay) {
  var input = document.createElement('input');
  input.type = 'range';
  input.min = 0;
  input.max = input.value = 100;

	
/*
	opacitySliderView = Ember.View.create({
  tagName: 'input',
	attributeBindings: ['min', 'max', 'type'],
	type: 'range',
	min: 0,
	max: 100,
	onchange: function() {
		overlay.setOpacity(this.value / 100);
	}
	
	});
	*/
	

  input.onchange = function() {
    overlay.setOpacity(this.value / 100);
  };

  return input;
}
//-----------------------------------------------------
/**
 * Editing UI for Overlays.
 *
 * @param {Overlay} overlay
 * @constructor
 */
function OverlayEditor(overlay) {
  this.set('overlay', overlay);
  this.bindTo('map', overlay);

  /**
   * @type {Array.<google.maps.Marker>}
   */
  this.markers_ = [
    this.addGCPControl_('topLeft'),
    this.addGCPControl_('topRight'),
   	this.addGCPControl_('bottomRight')
  ];

  this.addMover_();
  this.handleTranslate_();
}
OverlayEditor.prototype = new google.maps.MVCObject;

/**
 * Adds a ground control point to the overlay at a given corner.
 *
 * @param {string} anchor the corner name (e.g. topLeft).
 * @return {google.maps.Marker}
 * @private
 */
OverlayEditor.prototype.addGCPControl_ = function(anchor) {
  var marker = new google.maps.Marker({
    optimized: false,
    draggable: true,
		
  });
  marker.bindTo('map', this);

  this.get('overlay').bindTo(anchor, marker, 'position');
  this.set(anchor, marker);

  var that = this;
	google.maps.event.addListener(marker,'position_changed', function() {
    google.maps.event.trigger(that, 'gcpmove');
  });

  return marker;
};





/**
 * Adds a mover that's positioned in the middle of the overlay.
 *
 * @private
 */
OverlayEditor.prototype.addMover_ = function() {
  var oe = this;

  var marker = this.mover_ = new google.maps.Marker({
    draggable: true
  });
  marker.bindTo('map', this);

  var dragging = false;
  var prevLatLng;
	google.maps.event.addListener(marker, 'dragstart', function() {
    dragging = true;
    prevLatLng = this.getPosition();
  });
	google.maps.event.addListener(marker, 'dragend', function() {
    dragging = false;
  });
	google.maps.event.addListener(marker, 'drag', function(e) {
    var dLat = e.latLng.lat() - prevLatLng.lat();
    var dLng = e.latLng.lng() - prevLatLng.lng();
    oe.translate_(dLat, dLng);
    prevLatLng = this.getPosition();
  });
	google.maps.event.addListener(this, 'gcpmove', function() {
    if (dragging) return;

    var tl = oe.get('topLeft').getPosition();
    var br = oe.get('bottomRight').getPosition();

    if (!tl || !br) return;

    marker.setPosition(new google.maps.LatLng(
      (tl.lat() + br.lat()) / 2,
      (tl.lng() + br.lng()) / 2
    ));
  });
	
};

/**
 * Translates all anchor points by a number of degrees north and east.
 *
 * @param dLat {number} the delta in latitude.
 * @param dLng {number} the delta in longitude.
 * @private
 */
OverlayEditor.prototype.translate_ = function(dLat, dLng) {
  this.markers_.forEach(function(marker) {
    var position = marker.getPosition();
    marker.setPosition(new google.maps.LatLng(
      position.lat() + dLat,
      position.lng() + dLng
    ));
  });
};

/**
 * Translates all anchor points by a number of pixels.
 *
 * @param dx {number}
 * @param dy {number}
 * @private
 */
OverlayEditor.prototype.translatePixels_ = function(dx, dy) {
  var proj = this.get('overlay').getProjection();

  var before = this.mover_.getPosition();
  var p = proj.fromLatLngToDivPixel(before);
  p.x += dx;
  p.y += dy;
  var after = proj.fromDivPixelToLatLng(p);

  this.translate_(after.lat() - before.lat(), after.lng() - before.lng());
};

/**
 * Add event handling for translation.
 */
OverlayEditor.prototype.handleTranslate_ = function() {
  var listener;
  var that = this;
  var overlay = this.get('overlay');
  var map = overlay.getMap();
	google.maps.event.addListener(overlay, 'mousedown', function(e) {
    if (!e.metaKey) {
      return;
    }
    map.set('draggable', false);
    var prevEvent = e;
    listener && google.maps.event.removeListener(listener);
    listener = google.maps.event.addDomListener(document.body, 'mousemove',
        function(e) {
          that.translatePixels_(
              e.screenX - prevEvent.screenX,
              e.screenY - prevEvent.screenY);
          prevEvent = e;
        });
  });
	google.maps.event.addListener(overlay, 'mouseup', function(e) {
    map.set('draggable', true);
    listener && google.maps.event.removeListener(listener);
  });
};




/**
 * requestAnimationFrame shim.
 */
window.requestAnimFrame = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame


//add
//App.alignTiePointsContainerView.get('childViews').pushObject(AnotherViewClass.create());
//remove
//App.alignTiePointsContainerView.get('childViews').removeObject(aContainer.get('bView'));




