function getTransform(p) {
    if (p.length == 4) {
        var xscale = p[0];
        var yscale = p[1];
        var tx = p[2];
        var ty = p[3];
        return {
            type: "projective",
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
            type: "projective",
            n: 5,
            params: {
                xscale: xscale,
                yscale: yscale,
                theta: theta,
                tx: tx,
                ty: ty,
            },
            matrix: [[Math.cos(theta) * xscale, -Math.sin(theta) * yscale, tx],
                     [Math.sin(theta) * xscale, Math.cos(theta) * yscale, ty],
                     [0, 0, 1]]
        };

    } else if (p.length == 6) {
        return {
            type: "projective",
            n: 6,
            matrix: [[p[0], p[1], p[2]],
                     [p[3], p[4], p[5]],
                     [0, 0, 1]]
        };

    } else if (p.length == 8) {
        return {
            type: "projective",
            n: 8,
            matrix: [[p[0], p[1], p[2]],
                     [p[3], p[4], p[5]],
                     [p[6], p[7], 1]]
        };

    } else if (p.length == 12) {
        return {
            type: "quadratic",
            n: 12,
            matrix: [[p[0], p[1], p[2], p[3], p[4],
                      p[5], p[6], p[7], p[8], p[9],
                      0, 0, p[10], p[11], 1]]
        };

    } else {
        throw "error in getTransform: wrong number of parameters!";
    }    
}

function applyTransform(tform, points) {
    var U;
    if (tform.type == "projective") {
        U = getProjectiveUMatrixFromPoints(points);
    } else if (tform.type == "quadratic") {
        U = getQuadraticUMatrixFromPoints(points);
    }
    var height = tform.matrix.length;
    var width = tform.matrix[0].length;
    var T = new Matrix(width, height,
                       tform.matrix);
    var Vapprox0 = T.multiply(U);

    // projective rescale and truncate the bottom row
    var n = points.length;
    var Vapprox = new Matrix(n, 2);
    for (var i=0; i < n; i++) {
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

function func(p,ncom,pcom,xicom,points) //p is params to tMtx
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
    console.log('error: ' + JSON.stringify(error));
    */

    return error;
}

