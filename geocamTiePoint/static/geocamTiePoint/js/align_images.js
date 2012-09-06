// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

function align_images(points)
{
    var V = getVMatrixFromPoints(points);
    var U = getSimpleUMatrixFromPoints(points);

    // run linear regression
    var result = geocamTiePoint.linear_regression(V, U);
    var m = result[0];
    var b = result[1];

    // extract the named parameters the optimizer wants
    return {xscale: m.values[0][0],
            yscale: m.values[1][0],
            tx: b.values[0][0],
            ty: b.values[1][0]};
}

function test_align_error(name, a, b) {
    var err = Math.max(Math.abs(a.xscale - b.xscale),
                       Math.abs(a.yscale - b.yscale),
                       Math.abs(a.tx - b.tx),
                       Math.abs(a.ty - b.ty));
    if (err > 0.001) {
        console.log('ERROR case "' + name + '": values do not match');
        console.log(a);
        console.log(b);
    } else {
        console.log('OK case "' + name + '"');
    }
    return err;
}

function test_align_error2(name, points) {
    var result = align_images(points);
    var T = new Matrix(3, 2,
                       [[result.xscale, 0, result.tx],
                        [0, result.yscale, result.ty]]);
    var u = new Matrix(points.length, 3);
    var v = new Matrix(points.length, 2);
    var correctV = new Matrix(points.length, 2);
    for (var i = 0; i < points.length; i++) {
        correctV.values[0][i] = points[i][0];
        correctV.values[1][i] = points[i][1];
        u.values[0][i] = points[i][2];
        u.values[1][i] = points[i][3];
        u.values[2][i] = 1.0;
    }
    var v = T.multiply(u);
    var diff = correctV.add(v.multiply(-1));
    var err = diff.meanNorm();
    if (err > 0.001) {
        console.log('ERROR case "' + name + '": values do not match');
        console.log('v: ' + JSON.stringify(v));
        console.log('correctV: ' + JSON.stringify(correctV));
    } else {
        console.log('OK case "' + name + '"');
    }
}

function test_align_images() {
    var points1 = [[1, 1, 0, 0],
                   [3, 5, 1, 1]];
    var correct1 = {xscale: 2, yscale: 4, tx: 1, ty: 1};
    test_align_error('1', correct1, align_images(points1));
    test_align_error2('1', points1);
}

/* Given alignment model params @p and tie points @points, calculate the
 * sum-of-squares error value we want to minimize. */
function calculateAlignmentError(p, points)
{
    var V = getVMatrixFromPoints(points);
    var tform = getTransform(p);
    var Vapprox = applyTransform(tform, points);
    var Verror = Vapprox.subtract(V);
    var error = Verror.squareSum();

    /*
    console.log('V: ' + JSON.stringify(V));
    console.log('tform: ' + JSON.stringify(tform));
    console.log('Vapprox: ' + JSON.stringify(Vapprox));
    console.log('Verror: ' + JSON.stringify(Verror));
    console.log('error: ' + error.toExponential(8));
    */

    return error;
}

/* calculateAlignmentModel: Driver function that calls optimizer to
   generate tie point alignment. */
function calculateAlignmentModel(points)
{
    var x1 = new Array(); //to_pts (target pts)
    var y1 = new Array(); //to_pts (target pts)
    var x2 = new Array(); //from_pts
    var y2 = new Array(); //from_pts

    for (var i = 0; i < points.length; i++) {
        x1[i] = points[i][0];
        y1[i] = points[i][1];
        x2[i] = points[i][2];
        y2[i] = points[i][3];
    }

    var numTiePts = points.length;
    var ncom, pcom, xicom;
    var align_images_ret = align_images(points);
    console.log('points: ' + JSON.stringify(points));
    //test_align_error2('generateMatrix', points);

    //to access return values, do, align_images_ret.xscale
    console.log('align_images_ret: ' + JSON.stringify(align_images_ret));
    var xscale = align_images_ret.xscale;
    var yscale = align_images_ret.yscale;
    var tx = align_images_ret.tx;
    var ty = align_images_ret.ty;

    var theta = 0;

    // see func.js for implementation of these transforms
    console.log('numTiePts: ' + numTiePts);
    if (numTiePts >= 3) {
        // set up affine part
        var a = [Math.cos(theta) * xscale, -Math.sin(theta) * yscale, tx,
                 Math.sin(theta) * xscale, Math.cos(theta) * yscale, ty];

        var USE_QUADRATIC = true;
        if (USE_QUADRATIC && (numTiePts >= 7)) {
            // 12-parameter quadratic
            p = [0, 0, a[0], a[1], a[2],
                 0, 0, a[3], a[4], a[5],
                 0, 0];
        } else if (numTiePts >= 5) {
            // 8-parameter projective
            p = a.concat([0, 0]);
        } else {
            // 6-parameter affine
            p = a;
        }

    }
    /*
    else if (numTiePts >= 3) {
        // 5-parameter: scale, translation, rotation
        p = [xscale, yscale, theta, tx, ty];
    }*/
    else if (numTiePts >= 2) {
        // 4-parameter: scale, translation
        p = [xscale, yscale, tx, ty];
    } else {
        throw 'ERROR: generateMatrix: not enough tie points!';
    }

    var minFunc = function(p) { return calculateAlignmentError(p, points); }

    var minimizeResult = geocamTiePoint.minimize(minFunc, p);

    return getTransform(minimizeResult.finalParams);
}
