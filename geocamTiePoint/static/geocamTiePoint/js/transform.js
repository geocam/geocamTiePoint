// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var geocamTiePoint = window.geocamTiePoint || {};
geocamTiePoint.transform = {};

$(function($) {

    function getVMatrixFromPoints(points) {
        var V = new Matrix(points.length, 2);
        for (var i = 0; i < points.length; i++) {
            V.values[0][i] = points[i][0];
            V.values[1][i] = points[i][1];
        }
        return V;
    }

    function getSimpleUMatrixFromPoints(points) {
        var U = new Matrix(points.length, 2);
        for (var i = 0; i < points.length; i++) {
            U.values[0][i] = points[i][2];
            U.values[1][i] = points[i][3];
        }
        return U;
    }

    function getProjectiveUMatrixFromPoints(points) {
        var U = new Matrix(points.length, 3);
        for (var i = 0; i < points.length; i++) {
            U.values[0][i] = points[i][2];
            U.values[1][i] = points[i][3];
            U.values[2][i] = 1;
        }
        return U;
    }

    function getQuadraticUMatrixFromPoints(points) {
        var U = new Matrix(points.length, 5);
        for (var i = 0; i < points.length; i++) {
            U.values[0][i] = Math.pow(points[i][2], 2);
            U.values[1][i] = Math.pow(points[i][3], 2);
            U.values[2][i] = points[i][2];
            U.values[3][i] = points[i][3];
            U.values[4][i] = 1;
        }
        return U;
    }

    function getTransform(p) {
        if (p.length == 4) {
            var xscale = p[0];
            var yscale = p[1];
            var tx = p[2];
            var ty = p[3];
            return {
                type: 'projective',
                n: 4,
                params: {
                    xscale: xscale,
                    yscale: yscale,
                    tx: tx,
                    ty: ty
                },
                matrix: [[xscale, 0, tx],
                         [0, yscale, ty],
                         [0, 0, 1]]
            };

        } else if (p.length == 5) {
            var xscale = p[0];
            var yscale = p[1];
            var theta = p[2];
            var tx = p[3];
            var ty = p[4];
            return {
                type: 'projective',
                n: 5,
                params: {
                    xscale: xscale,
                    yscale: yscale,
                    theta: theta,
                    tx: tx,
                    ty: ty
                },
                matrix: [[Math.cos(theta) * xscale,
                          -Math.sin(theta) * yscale, tx],
                         [Math.sin(theta) * xscale,
                          Math.cos(theta) * yscale, ty],
                         [0, 0, 1]]
            };

        } else if (p.length == 6) {
            return {
                type: 'projective',
                n: 6,
                matrix: [[p[0], p[1], p[2]],
                         [p[3], p[4], p[5]],
                         [0, 0, 1]]
            };

        } else if (p.length == 8) {
            return {
                type: 'projective',
                n: 8,
                matrix: [[p[0], p[1], p[2]],
                         [p[3], p[4], p[5]],
                         [p[6], p[7], 1]]
            };

        } else if (p.length == 12) {
            /*
              return {
              type: 'quadratic',
              n: 12,
              matrix: [[p[0], p[1], p[2], p[3], p[4]],
              [p[5], p[6], p[7], p[8], p[9]],
              [0, 0, p[10], p[11], 1]]
              };*/
            return {
                type: 'quadratic2',
                n: 12,
                matrix: [[p[0], p[1], p[2]],
                         [p[3], p[4], p[5]],
                         [p[6], p[7], 1]],
                quadraticTerms: [p[8], p[9], p[10], p[11]]
            };

        } else {
            throw 'error in getTransform: wrong number of parameters!';
        }
    }

    function applyMatrixAndRescale(matrix, U) {
        var height = matrix.length;
        var width = matrix[0].length;
        var T = new Matrix(width, height, matrix);

        /*
          console.log(width);
          console.log(height);
          console.log('T: ' + JSON.stringify(T));
        */

        var Vapprox0 = T.multiply(U);

        // projective rescale and truncate the bottom row
        var n = U.w;
        var Vapprox = new Matrix(n, 2);
        for (var i = 0; i < n; i++) {
            var z = Vapprox0.values[2][i];
            Vapprox.values[0][i] = Vapprox0.values[0][i] / z;
            Vapprox.values[1][i] = Vapprox0.values[1][i] / z;
        }

        /*
          console.log('U: ' + JSON.stringify(U));
          console.log('T: ' + JSON.stringify(T));
          console.log('Vapprox0: ' + JSON.stringify(Vapprox0));
          console.log('Vapprox: ' + JSON.stringify(Vapprox));
        */

        return Vapprox;
    }

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
        return new Matrix(1, 3,
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

    function forwardPts(tform, fromPts) {
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
        function residuals(x) {
            var err = y.subtract(f(x)).meanNorm();
            // console.log(JSON.stringify(x));
            return err;
        }
        return (geocamTiePoint
                .minimize(residuals, x0)
                .finalParams);
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

    function Transform() {}

    Transform.fit = function(cls, toPts, fromPts) {
        var params0 = cls.getInitParams(toPts, fromPts);
        var params = (leastSquares
                      (toPts,
                       function(params) {
                           return forwardPts(cls.fromParams(params), fromPts);
                       },
                       params0));
        return params;
    };

    function LinearTransform(matrix) {
        this.matrix = matrix;
    }

    LinearTransform.prototype = $.extend(true,
                                         Transform.prototype,
                                         {});

    LinearTransform.prototype.forward = function(pt) {
        var u = columnVectorFromPt(pt);
        var v = this.matrix.multiply(u);
        return ptFromColumnVector(v);
    };

    LinearTransform.prototype.toDict = function() {
        return {
            type: "projective",
            matrix: this.matrix.values
        };
    };

    function AffineTransform(matrix) {
        this.matrix = matrix;
    }

    AffineTransform.prototype = $.extend(true,
                                         LinearTransform.prototype,
                                         {});

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

    function RotateScaleTranslateTransform(matrix) {
        this.matrix = matrix;
    }

    (RotateScaleTranslateTransform.prototype =
     $.extend(true,
              LinearTransform.prototype,
              {}));

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

    function ProjectiveTransform(matrix) {
        this.matrix = matrix;
    }

    ProjectiveTransform.prototype = $.extend(true,
                                             LinearTransform.prototype,
                                             {});

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

    function QuadraticTransform2(matrix, quadraticTerms) {
        this.matrix = matrix;
        this.quadraticTerms = quadraticTerms;
    }

    QuadraticTransform2.prototype = $.extend(true,
                                             Transform.prototype,
                                             {});

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

    QuadraticTransform2.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);
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

        return [r, s];
    };

    QuadraticTransform2.prototype.toDict = function() {
        return {
            type: "quadratic2",
            matrix: this.matrix.values,
            quadraticTerms: this.quadraticTerms
        };
    };

    function applyProjectiveTransform(tform, points) {
        var U = getProjectiveUMatrixFromPoints(points);
        return applyMatrixAndRescale(tform.matrix, U);
    }

    function applyQuadraticTransform(tform, points) {
        var U = getQuadraticUMatrixFromPoints(points);
        return applyMatrixAndRescale(tform.matrix, U);
    }

    function applyQuadraticTransform2(tform, points) {
        var U = getProjectiveUMatrixFromPoints(points);
        var V0 = applyMatrixAndRescale(tform.matrix, U);

        var a = tform.quadraticTerms[0];
        var b = tform.quadraticTerms[1];
        var c = tform.quadraticTerms[2];
        var d = tform.quadraticTerms[3];

        var n = points.length;
        var V = new Matrix(n, 2);
        for (var i = 0; i < n; i++) {
            var x = V0.values[0][i];
            var y = V0.values[1][i];

            var p = x + a * x * x;
            var q = y + b * y * y;
            var r = p + c * q * q;
            var s = q + d * r * r;

            V.values[0][i] = r;
            V.values[1][i] = s;
        }

        return V;
    }

    function applyTransform(tform, points) {
        if (tform.type == 'projective') {
            return applyProjectiveTransform(tform, points);
        } else if (tform.type == 'quadratic') {
            return applyQuadraticTransform(tform, points);
        } else if (tform.type == 'quadratic2') {
            return applyQuadraticTransform2(tform, points);
        } else {
            throw 'unknown transform type ' + tform.type;
        }
    }

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

    // exports
    var ns = geocamTiePoint.transform;
    ns.getTransform = getTransform;
});
