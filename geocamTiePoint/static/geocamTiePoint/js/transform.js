// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var geocamTiePoint = window.geocamTiePoint || {};
geocamTiePoint.transform = {};

$(function($) {

    function matrixFromNestedList(nestedList) {
        var height = nestedList.length;
        var width = nestedList[0].length;
        return new Matrix(width, height, nestedList);
    }

    function columnVectorFromPt(pt) {
        return new Matrix(1, 3,
                          [[pt[0]],
                           [pt[1]],
                           [1]]);
    }

    function quadraticColumnVectorFromPt(pt) {
        return new Matrix(1, 5,
                          [[pt[0] * pt[0]],
                           [pt[1] * pt[1]],
                           [pt[0]],
                           [pt[1]],
                           [1]]);
    }

    function ptFromColumnVector(v) {
        var z = v.values[2][0];
        return [v.values[0][0] / z,
                v.values[1][0] / z];
    }

    function forwardPoints(tform, fromPts) {
        var toPts = new Matrix(fromPts.w, fromPts.h);
        var n = fromPts.w;
        for (var i = 0; i < n; i++) {
            var x = fromPts.values[0][i];
            var y = fromPts.values[1][i];

            var out = tform.forward([x, y]);

            toPts.values[0][i] = out[0];
            toPts.values[1][i] = out[1];
        }
        return toPts;
    }

    function linearLeastSquares(V, U) {
        var tmp = U.transpose().multiply(V);
        return U.transpose().multiply(U).invert().multiply(tmp);
    }

    function leastSquares(y, f, x0) {
        var result = geocamTiePoint.optimize.lm(y, f, x0);
        return result[0];
    }

    function splitPoints(points) {
        var n = points.length;
        var toPts = new Matrix(n, 2);
        var fromPts = new Matrix(n, 2);
        for (var i = 0; i < n; i++) {
            toPts.values[0][i] = points[i][0];
            toPts.values[1][i] = points[i][1];
            fromPts.values[0][i] = points[i][2];
            fromPts.values[1][i] = points[i][3];
        }
        return [toPts, fromPts];
    }

    /**********************************************************************
     * Transform
     **********************************************************************/

    function Transform() {}

    Transform.fit = function(cls, toPts, fromPts) {
        var params0 = cls.getInitParams(toPts, fromPts);
        //console.log(params0);
        var params = (leastSquares
                      (toPts.flatten(),
                       function(params) {
                           return (forwardPoints(cls.fromParams(params),
                                                 fromPts)
                                   .flatten());
                       },
                       params0));
        return params;
    };

    /**********************************************************************
     * LinearTransform
     **********************************************************************/

    function LinearTransform(matrix) {
        this.matrix = matrix;
    }

    LinearTransform.prototype = $.extend(true,
                                         {},
                                         Transform.prototype);

    LinearTransform.prototype.forward = function(pt) {
        var u = columnVectorFromPt(pt);
        var v = this.matrix.multiply(u);
        return ptFromColumnVector(v);
    };

    LinearTransform.prototype.toDict = function() {
        return {
            type: 'projective',
            matrix: this.matrix.values
        };
    };

    /**********************************************************************
     * AffineTransform
     **********************************************************************/

    function AffineTransform(matrix) {
        this.matrix = matrix;
    }

    AffineTransform.prototype = $.extend(true,
                                         {},
                                         LinearTransform.prototype);

    AffineTransform.fit = function(cls, toPts, fromPts) {
        var n = toPts.w;
        var V = new Matrix(1, 2 * n);
        var U = new Matrix(6, 2 * n);
        for (var i = 0; i < n; i++) {
            V.values[2 * i][0] = toPts.values[0][i];
            V.values[2 * i + 1][0] = toPts.values[1][i];

            U.values[2 * i][0] = fromPts.values[0][i];
            U.values[2 * i][1] = fromPts.values[1][i];
            U.values[2 * i][2] = 1;
            U.values[2 * i + 1][3] = fromPts.values[0][i];
            U.values[2 * i + 1][4] = fromPts.values[1][i];
            U.values[2 * i + 1][5] = 1;
        }
        var p = linearLeastSquares(V, U);
        return [p.values[0][0],
                p.values[1][0],
                p.values[2][0],
                p.values[3][0],
                p.values[4][0],
                p.values[5][0]];
    };

    AffineTransform.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [0, 0, 1]]);
        return new AffineTransform(matrix);
    };

    /**********************************************************************
     * RotateScaleTranslateTransform
     **********************************************************************/

    function RotateScaleTranslateTransform(matrix) {
        this.matrix = matrix;
    }

    (RotateScaleTranslateTransform.prototype =
     $.extend(true,
              {},
              LinearTransform.prototype));

    RotateScaleTranslateTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new RotateScaleTranslateTransform(matrix);
    };

    RotateScaleTranslateTransform.fromParams = function(p) {
        var tx = p[0];
        var ty = p[1];
        var scale = p[2];
        var theta = p[3];

        var translateMatrix = new Matrix(3, 3,
                                         [[1, 0, tx],
                                          [0, 1, ty],
                                          [0, 0, 1]]);
        var scaleMatrix = new Matrix(3, 3,
                                     [[scale, 0, 0],
                                      [0, scale, 0],
                                      [0, 0, 1]]);
        var rotateMatrix = new Matrix(3, 3,
                                      [[Math.cos(theta), -Math.sin(theta), 0],
                                       [Math.sin(theta), Math.cos(theta), 0],
                                       [0, 0, 1]]);
        var matrix = (translateMatrix
                      .multiply(scaleMatrix)
                      .multiply(rotateMatrix));
        return new RotateScaleTranslateTransform(matrix);
    };

    RotateScaleTranslateTransform.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);

        var tx = p[2];
        var ty = p[5];
        var scale = (p[0] * p[4] - p[1] * p[3]);
        var theta = Math.atan2(-p[1], p[0]);

        return [tx, ty, scale, theta];
    };

    RotateScaleTranslateTransform.fit = Transform.fit;

    /**********************************************************************
     * ProjectiveTransform
     **********************************************************************/

    function ProjectiveTransform(matrix) {
        this.matrix = matrix;
    }

    ProjectiveTransform.prototype = $.extend(true,
                                             {},
                                             LinearTransform.prototype);

    ProjectiveTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new ProjectiveTransform(matrix);
    };

    ProjectiveTransform.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [p[6], p[7], 1]]);
        return new ProjectiveTransform(matrix);
    };

    ProjectiveTransform.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);
        return p.concat([0, 0]);
    };

    ProjectiveTransform.fit = Transform.fit;

    /**********************************************************************
     * QuadraticTransform
     **********************************************************************/

    function QuadraticTransform(matrix) {
        this.matrix = matrix;
    }

    QuadraticTransform.prototype = $.extend(true,
                                            {},
                                            Transform.prototype);

    QuadraticTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new QuadraticTransform(matrix);
    };

    QuadraticTransform.fromParams = function(p) {
        var matrix = new Matrix(5, 3,
                                [[p[0], p[1], p[2], p[3], p[4]],
                                 [p[5], p[6], p[7], p[8], p[9]],
                                 [0, 0, p[10], p[11], 1]]);
        return new QuadraticTransform(matrix);
    };

    QuadraticTransform.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);
        return [0, 0, p[0], p[1], p[2],
                0, 0, p[3], p[4], p[5],
                0, 0];
    };

    QuadraticTransform.fit = Transform.fit;

    QuadraticTransform.prototype.forward = function(pt) {
        var u = quadraticColumnVectorFromPt(pt);
        var v = this.matrix.multiply(u);
        return ptFromColumnVector(v);
    };

    QuadraticTransform.prototype.toDict = function() {
        return {
            type: 'quadratic',
            matrix: this.matrix.values
        };
    };

    /**********************************************************************
     * QuadraticTransform2
     **********************************************************************/

    /* QuadraticTransform2 is similar to QuadraticTransform but modified
     * slightly to make it easy to invert analytically (see //
     * transform.py). The modification introduces some 4th and 6th order
     * terms that should not make much difference in practice.
     *
     * In order to improve numerical stability when fitting tie points,
     * the forward transfrom output is rescaled by a factor of SCALE at
     * the last step. Thus the entries in the matrix will be much
     * smaller than for the other Transform types. */

    function QuadraticTransform2(matrix, quadraticTerms) {
        this.matrix = matrix;
        this.quadraticTerms = quadraticTerms;
    }

    QuadraticTransform2.prototype = $.extend(true,
                                             {},
                                             Transform.prototype);

    QuadraticTransform2.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new QuadraticTransform2(matrix,
                                       transformDict.quadraticTerms);
    };

    QuadraticTransform2.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [p[6], p[7], 1]]);
        var quadraticTerms = [p[8], p[9], p[10], p[11]];
        return new QuadraticTransform2(matrix, quadraticTerms);
    };

    var SCALE = 1e+7;

    QuadraticTransform2.getInitParams = function(toPts, fromPts) {
        // pre-conditioning by SCALE improves numerical stability
        var toPtsConditioned = toPts.multiply(1.0 / SCALE);
        var p = AffineTransform.fit(AffineTransform, toPtsConditioned, fromPts);
        return p.concat([0, 0, 0, 0, 0, 0]);
    };

    QuadraticTransform2.fit = Transform.fit;

    QuadraticTransform2.prototype.forward = function(pt) {
        var u = columnVectorFromPt(pt);
        var v0 = this.matrix.multiply(u);
        var v1 = ptFromColumnVector(v0);

        var x = v1[0];
        var y = v1[1];

        var a = this.quadraticTerms[0];
        var b = this.quadraticTerms[1];
        var c = this.quadraticTerms[2];
        var d = this.quadraticTerms[3];

        var p = x + a * x * x;
        var q = y + b * y * y;
        var r = p + c * q * q;
        var s = q + d * r * r;

        // correct for pre-conditioning
        r = r * SCALE;
        s = s * SCALE;

        return [r, s];
    };

    QuadraticTransform2.prototype.toDict = function() {
        return {
            type: 'quadratic2',
            matrix: this.matrix.values,
            quadraticTerms: this.quadraticTerms
        };
    };

    /**********************************************************************
     * top-level functions
     **********************************************************************/

    function getTransformClass(n) {
        if (n < 2) {
            throw 'not enough tie points';
        } else if (n == 2) {
            return RotateScaleTranslateTransform;
        } else if (n == 3) {
            return AffineTransform;
        } else if (n < 7) {
            return ProjectiveTransform;
        } else {
            return QuadraticTransform2;
        }
    }

    function getTransform0(toPts, fromPts) {
        var n = toPts.w;
        var cls = getTransformClass(n);
        var params = cls.fit(cls, toPts, fromPts);
        return cls.fromParams(params);
    }

    function getTransform(points) {
        var s = splitPoints(points);
        var toPts = s[0];
        var fromPts = s[1];
        return getTransform0(toPts, fromPts);
    }

    function deserializeTransform(transformJSON) {
        var classmap = {
            'projective': ProjectiveTransform,
            'quadratic': QuadraticTransform,
            'quadratic2': QuadraticTransform2,
        }
        if (! transformJSON in classmap) throw "Unexpected transform type";
        var transformClass = classmap[transformJSON.type];
        return new transformClass( matrixFromNestedList(transformJSON.matrix) )
    }

    /**********************************************************************
     * exports
     **********************************************************************/

    var ns = geocamTiePoint.transform;

    ns.getTransform = getTransform;
    ns.splitPoints = splitPoints;
    ns.forwardPoints = forwardPoints;
    ns.deserializeTransform = deserializeTransform;
});
