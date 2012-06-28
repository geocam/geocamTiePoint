
function align_images(points)
{
    // convert to matrix format
    var V = new Matrix(points.length, 2);
    var U = new Matrix(points.length, 2);
    for (var i=0; i < points.length; i++) {
        V.values[0][i] = points[i][0];
        V.values[1][i] = points[i][1];
        U.values[0][i] = points[i][2];
        U.values[1][i] = points[i][3];
    }

    // run linear regression
    var result = linear_regression(V, U);
    var m = result[0];
    var b = result[1];

    // extract the named parameters the optimizer wants
    return {xscale: m.values[0][0],
            yscale: m.values[1][0],
            tx: b.values[0][0],
            ty: b.values[1][0]};
}

function linear_regression(V, U)
{
    // Let V and U be two d x n matrices whose columns are length-d
    // vectors v_i and u_i.  We want to fit a model v_i = m * u_i + b,
    // where m and b are length-d vectors and * is element-wise
    // multiplication.  We'll choose the model to minimize least-squares
    // error.

    // http://en.wikipedia.org/wiki/Simple_linear_regression

    // The solution looks like:
    //   m = [mean(uv) - mean(u) mean(v)] / [mean(u**2) - mean(u)**2]
    //   b = mean(v) - m * mean(u)
    
    var mean_uv = U.elementMultiply(V).meanColumn();
    var mean_u = U.meanColumn();
    var mean_v = V.meanColumn();
    var mean_uu = U.elementMultiply(U).meanColumn();
    var m = (mean_uv.subtract(mean_u.elementMultiply(mean_v)))
        .elementDivide(mean_uu.subtract(mean_u.elementMultiply(mean_u)));
    var b = mean_v.subtract(m.elementMultiply(mean_u));
    if (0) {
        console.log('U: ' + JSON.stringify(U));
        console.log('V: ' + JSON.stringify(V));
        console.log('mean_uv: ' + JSON.stringify(mean_uv));
        console.log('mean_u: ' + JSON.stringify(mean_u));
        console.log('mean_v: ' + JSON.stringify(mean_v));
        console.log('mean_uu: ' + JSON.stringify(mean_uu));
        console.log('m: ' + JSON.stringify(m));
        console.log('b: ' + JSON.stringify(b));
    }
    return [m, b];
}

function test_align_error(name, a, b) {
    var err = Math.max(Math.abs(a.xscale - b.xscale),
                       Math.abs(a.yscale - b.yscale),
                       Math.abs(a.tx - b.tx),
                       Math.abs(a.ty - b.ty));
    if (err > 0.001) {
        console.log('ERROR case "' + name + '": values do not match');
        console.log(a)
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
    for (var i=0; i < points.length; i++) {
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
        console.log('v: ' + JSON.stringify(v))
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
