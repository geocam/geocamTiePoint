Installation
============

Fill me in

Coordinate Systems
==================

MapFasten uses two main coordinate systems:

 * The image coordinate system measures position in pixels (x, y) where
   (0, 0) is the upper-left corner of the image, x increases to the
   right, and y increases down.
 * The Spherical Mercator coordinate system expresses position on the
   Earth's surface. (x, y) coordinates. Roughly speaking, x increases to
   the east and y increases to the north. The origin matches the origin
   in lat/lon coordinates. The scale of the units approximates
   displacement in meters.  This system is also known as EPSG:3857 or
   EPSG:900913.

Two-way conversions between lat/lon and Spherical Mercator can be found
in the ``latLonToMeters`` and ``metersToLatLon`` functions:

 * `JavaScript coordinate conversions <https://github.com/geocam/geocamTiePoint/blob/master/geocamTiePoint/static/geocamTiePoint/js/coords.js>`_
 * `Python coordinate conversions <https://github.com/geocam/geocamTiePoint/blob/master/geocamTiePoint/quadTree.py>`_

Some other references:

 * `Google Maps Coordinates, Tile Bounds, and Projection <http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/>`_
 * `PROJ.4 FAQ: Google Mercator <http://trac.osgeo.org/proj/wiki/FAQ#ChangingEllipsoidWhycantIconvertfromWGS84toGoogleEarthVirtualGlobeMercator>`_

Export Format
=============

Exporting an overlay produces a gzip-compressed tar archive containing
Google Maps image pyramid tiles from the aligned overlay along with
additional meta-data files. *NOTE: We may change the format of these
files going forward.*

Meta-Data Format: meta.json
~~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``transform`` field represents a best-fit transform that maps image
coordinates to Spherical Mercator coordinates. Depending on the number
of tie points specified, the transform can be expressed in two forms:

 * ``"type": "projective"``. This is a 2D projective transform. Used when
   fewer than 7 tie point pairs are specified. The ``matrix`` field is a
   3x3 transformation matrix ``M`` specified in row-major order. To apply
   the transform:

   * Start with image coordinates ``(x, y)``.

   * Convert to a length-3 column vector ``u`` in homogeneous coordinates: ``u = (x, y, 1)``

   * Matrix multiply ``(x0, y0, w) = M * u``.

   * Normalize homogeneous coordinates: ``x' = x0 / w``, ``y' = y0 / w``.

   * The resulting Spherical Mercator coordinates are ``(x', y')``.

 * ``"type": "quadratic2"``. This transform is similar to the projective
   transform but adds higher-order terms to achieve a better fit when
   the overlay image uses a different map projection from the base
   layer. Used when 7 or more tie point pairs are specified. Please
   refer to the code for full details. Some points of interest:

   * Note that despite the name, this transform is *not* exactly
     quadratic. In order to ensure the transform has a simple analytical
     inverse, corrections are applied serially, which incidentally
     introduces some 4th-order and 6th-order terms.

   * The ``matrix`` field has essentially the same interpretation as for
     the 'projective' transform.

   * In order to help with numerical stability during optimization, the
     last step of the transform is to scale the result by 1e+7.  Because
     of this, the matrix entries will appear much smaller than those in
     the projective transform.

   * The coefficients for higher-order terms are encoded in the
     ``quadraticTerms`` field. If all of those terms are 0, the
     ``quadratic2`` transform reduces to a ``projective`` transform.

See the alignment transform reference implementations in the
``ProjectiveTransform`` and ``QuadraticTransform2`` classes:

 * `JavaScript alignment transforms <https://github.com/geocam/geocamTiePoint/blob/master/geocamTiePoint/static/geocamTiePoint/js/transform.js>`_
 * `Python alignment transforms <https://github.com/geocam/geocamTiePoint/blob/master/geocamTiePoint/transform.py>`_

.. o __BEGIN_LICENSE__
.. o Copyright (C) 2008-2010 United States Government as represented by
.. o the Administrator of the National Aeronautics and Space Administration.
.. o All Rights Reserved.
.. o __END_LICENSE__
