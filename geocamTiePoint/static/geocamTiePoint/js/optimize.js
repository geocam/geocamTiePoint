// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

if (! window.geocamTiePoint) { window.geocamTiePoint = {}; }

geocamTiePoint.optimize = {};

/* optimize.js exports the following functions to the geocamTiePoint
 * namespace:
 *
 * x = geocamTiePoint.minimize(fun, x0)
 *
 * [m, b] = geocamTiePoint.linear_regression(V, U)
 *
 */

(function() {
    /* f1dim: Breaks down the multidimensional function to one-d function
     * for golden to handle. */

    function f1dim(func, x, ncom, pcom, xicom)
    {
        var xt = new Array(ncom);
        for (var i = 0; i < ncom; i++) {
            xt[i] = pcom[i] + x * xicom[i];
        }
        return func(xt);
    }

    /* Performs one-dimensional Golden Section Search. Referenced
     * pseudo-code in Numerical Recipes. */
    function golden(func, ax, bx, cx, tol, ncom, pcom, xicom)
    {
        var ITMAX = 100;
        var R = 0.61803399;
        var C = 1.0 - R;
        var x0 = ax;
        var x1;
        var x2;
        var x3 = cx;

        if (Math.abs(cx - bx) > Math.abs(bx - ax)) {
            x1 = bx;
            x2 = bx + C * (cx - bx);
        } else {
            x2 = bx;
            x1 = bx - C * (bx - ax);
        }

        var f1 = f1dim(func, x1, ncom, pcom, xicom);
        var f2 = f1dim(func, x2, ncom, pcom, xicom);

        var step = 0;
        var tmp;
        while (Math.abs(x3 - x0) > tol * (Math.abs(x1) + Math.abs(x2))) {
            if (f2 < f1) {
                var tmp = R * x2 + C * x3;
                x0 = x1;
                x1 = x2;
                x2 = tmp;

                var tmp = f1dim(func, x2, ncom, pcom, xicom);
                f1 = f2;
                f2 = tmp;
            } else {
                var tmp = R * x1 + C * x0;
                x3 = x2;
                x2 = x1;
                x1 = tmp;

                var tmp = f1dim(func, x1, ncom, pcom, xicom);
                f2 = f1;
                f1 = tmp;
            }
            if (step >= ITMAX) {
                throw 'golden: iterations maxed out';
            }
            step++;
        }

        if (f1 < f2) {
            xmin = x1;
            fret = f1;
            return {xmin: xmin, fret: fret};
        } else {
            xmin = x2;
            fret = f2;
            return {xmin: xmin, fret: fret};
        }
    }

    /* linmin: Basically a wrapper to extend one-dimensional
     * optimization function to multi-dimensional optimization. Need to
     * call golden section search from linmin in order for it to be used
     * by powell, which performs multi-dimensional optimization. */
    function linmin(func, p, xi, ncom, pcom, xicom)
    {
        var TOL = Math.exp(-8);
        var n = p.length;
        ncom = n;
        pcom = p;
        xicom = xi;

        var ax = 0.0;
        var xx = 1.0;
        var fret = 0;

        var mnbrak_ret = mnbrak(func, ax, xx, ncom, pcom, xicom);

        ax = mnbrak_ret.ax;
        xx = mnbrak_ret.bx;
        var bx = mnbrak_ret.cx;

        var golden_ret = golden(func, ax, xx, bx, TOL, ncom, pcom, xicom);
        var xmin = golden_ret.xmin;
        var fret = golden_ret.fret;

        for (var j = 0; j < xi.length; j++) {
            xi[j] = xi[j] * xmin;
            p[j] = p[j] + xi[j];
        }

        xicom = null;
        pcom = null;

        return {p: p, xi: xi, fret: fret};
    }

    /* mnbrak: Given two initial points, finds three points that
     * brackets the minimum.  The bracket points are passed to golden
     * section search. */
    function mnbrak(func, ax, bx, ncom, pcom, xicom)
    {
        var GOLD = 1.618034;
        var GLIMIT = 100.0;
        var TINY = 1e-20;
        var ITMAX = 100;
        var fa = f1dim(func, ax, ncom, pcom, xicom);
        var fb = f1dim(func, bx, ncom, pcom, xicom);

        if (fb > fa) {
            var temp = ax;
            ax = bx;
            bx = temp;

            temp = fb;
            fb = fa;
            fa = temp;
        }

        var cx = bx + GOLD * (bx - ax);
        var fc = f1dim(func, cx, ncom, pcom, xicom);

        var step = 0;

        while (fb > fc) {

            var r = (bx - ax) * (fb - fc);
            var q = (bx - cx) * (fb - fa);
            var u = bx - ((bx - cx) * q - (bx - ax) * r) /
                (2.0 * SIGN(Math.max(Math.abs(q - r), TINY), q - r));
            var ulim = bx + GLIMIT * (cx - bx);
            if ((bx - u) * (u - cx) > 0.0) {
                var fu = f1dim(func, u, ncom, pcom, xicom);
                if (fu < fc) {
                    ax = bx;
                    bx = u;
                    fa = fb;
                    fb = fu;
                    return {ax: ax, bx: bx, cx: cx};
                } else if (fu > fb) {
                    cx = u;
                    fc = fu;
                    return {ax: ax, bx: bx, cx: cx};
                }
                u = cx + GOLD * (cx - bx);
                fu = f1dim(func, u, ncom, pcom, xicom);
            } else if ((cx - u) * (u - ulim) > 0.0) {
                fu = f1dim(func, u, ncom, pcom, xicom);
                if (fu < fc) {
                    var tmp = cx + GOLD * (cx - bx);
                    bx = cx;
                    cx = u;
                    u = tmp;

                    var tmp = f1dim(func, u, ncom, pcom, xicom);
                    fb = fc;
                    fc = fu;
                    fu = tmp;
                }
            } else if ((u - ulim) * (ulim - cx) >= 0.0) {
                u = ulim;
                fu = f1dim(func, u, ncom, pcom, xicom);
            } else {
                u = cx + GOLD * (cx - bx);
                fu = f1dim(func, u, ncom, pcom, xicom);
            }

            ax = bx;
            bx = cx;
            cx = u;

            fa = fb;
            fb = fc;
            fc = fu;

            if (step >= ITMAX) {
                throw 'mnbrak iterations maxed out';
            }
            step++;
        }
        return {ax: ax, bx: bx, cx: cx};
    }

    function SIGN(a, b)
    {
        if (b > 0.0) {
            return Math.abs(a);
        } else {
            return -1 * Math.abs(a);
        }
    }

    /* Uses Powell's Method to find a local minimum of a function. No
     * derivatives are needed to find the minimum. */
    function powell(func, p, xi, ftol, ncom, pcom, xicom)
    {
        var ITMAX = 200;
        var TINY = 1e-25;
        var n = p.length;
        var iter;
        var linmin_ret;
        var fptt;
        var fp;
        var ibig;
        var del;
        var t;
        var pt = new Array(n);
        var ptt = new Array(n);
        var xit = new Array(n);
        var fret = func(p, ncom, pcom, xicom);

        for (var j = 0; j < n; j++) {
            pt[j] = p[j];
        }

        for (iter = 0; iter < ITMAX; ++iter) {
            fp = fret;
            ibig = 0;
            del = 0.0;

            for (var i = 0; i < n; i++) {
                for (var j = 0; j < n; j++) {
                    xit[j] = xi.values[j][i];
                }
                fptt = fret;
                linmin_ret = linmin(func, p, xit, ncom, pcom, xicom);
                p = linmin_ret.p;
                xit = linmin_ret.xi;
                fret = linmin_ret.fret;

                if ((fptt - fret) > del) {
                    del = fptt - fret;
                    ibig = i + 1;
                }
            }

            if ((2.0 * (fp - fret)) <=
                (ftol * (Math.abs(fp) + Math.abs(fret)) + TINY)) {
                return {finalParams: p, iter: iter, fret: fret, xi: xi};
            }

            for (var i = 0; i < n; i++) {
                ptt[i] = 2.0 * p[i] - pt[i];
                xit[i] = p[i] - pt[i];
                pt[i] = p[i];
            }


            fptt = func(ptt, ncom, pcom, xicom);

            if (fptt < fp) {

                t = 2.0 * (fp - 2.0 * fret + fptt) *
                    (Math.pow(fp - fret - del, 2)) -
                    del * (Math.pow(fp - fptt, 2));

                if (t < 0.0) {
                    linmin_ret = linmin(func, p, xit, ncom, pcom, xicom);
                    p = linmin_ret.p;
                    xit = linmin_ret.xi;
                    fret = linmin_ret.fret;
                    for (var j = 0; j < n; j++) {
                        xi.values[j][ibig - 1] = xi.values[j][n - 1];
                        xi.values[j][n - 1] = xit[j];
                    }
                }
            }
       }
        throw 'ERROR in powell.js: iteration maxed out';
    }

    /**
     * [m, b] = geocamTiePoint.linear_regression(V, U) -- Return the
     * scalar values m and b that minimize the least-squares error for
     * the model V = m * U + b. V and U must be matrices with the same
     * dimensions.
     */
    geocamTiePoint.linear_regression = function(V, U)
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
    };

    var ncom;
    var pcom;
    var xicom;

    /**
     * x = geocamTiePoint.minimize(fun, x0): Find the local minimum
     * of fun near x0.
     */
    geocamTiePoint.minimize = function(fun, x0) {
        ncom = 0;
        pcom = [];
        xicom = [];

        //matrix of unit vectors
        var n = x0.length;
        var xi = new Array(n);
        for (var i = 0; i < n; i++) {
            xi[i] = new Array(n);
            for (var j = 0; j < n; j++) {
                if (i == j) {
                    xi[i][j] = 1;
                } else {
                    xi[i][j] = 0;
                }
            }
        }
        var xiM = new Matrix(n, n, xi);
        var ftol = 0.001;

        return powell(fun, x0, xiM, ftol, ncom, pcom, xicom);
    }

    function linearLeastSquares(V, U) {
        var tmp = U.transpose().multiply(V);
        return U.transpose().multiply(U).invert().multiply(tmp);
    }

    // default arguments
    var LM_DEFAULT_ABS_TOLERANCE = 1e-16;
    var LM_DEFAULT_REL_TOLERANCE = 1e-16;
    var LM_DEFAULT_MAX_ITERATIONS = 1000; // FIX 100;

    // status values
    var LM_DID_NOT_CONVERGE = -1;
    var LM_STATUS_UNKNOWN = 0;
    var LM_CONVERGED_ABS_TOLERANCE = 1;
    var LM_CONVERGED_REL_TOLERANCE = 2;


    /* Rather stupid numerical Jacobian used by default in lm(). Much better
     * to supply an analytical Jacobian if you can. */
    function numericalJacobian(f) {
        function jacobian(x) {
            var k = x.h;
            var y = f(x.tolist());
            var n = y.h;
            var xp = new Matrix(1, k);
            var result = new Matrix(k, n);
            for (var i = 0; i < k; i++) {
                for (var j = 0; j < k; j++) {
                    xp.values[j][0] = x.values[j][0];
                }
                var eps = 1e-7 + Math.abs(1e-7 * x.values[i][0]);
                xp.values[i][0] = xp.values[i][0] + eps;
                var yp = f(xp.tolist());
                var ydiff = yp.subtract(y);
                for (var j = 0; j < n; j++) {
                    result.values[j][i] = ydiff.values[j][0] / eps;
                }
            }
            return result;
        }
        return jacobian;
    }


    /* Use the Levenberg-Marquardt algorithm to calculate a local minimum
     * x for the error function
     *
     * E = || diff(y, f(x)) || ** 2
     *
     * in the neighborhood of x0. The default diff function is simple
     * subtraction.  You can improve numerical stability by providing an
     * analytical jacobian for f.
     *
     * This is a Python adaptation of the C++ L-M implementation from
     * the NASA Vision Workbench.
     */

    function lm(y, f, x0, opts) {
        if (opts == undefined) {
            opts = {};
        }
        var diff = (opts.diff ||
                    function(u, v) { return u.subtract(v); });
        var jacobian = (opts.jacobian ||
                        numericalJacobian(f));
        var absTolerance = (opts.absTolerance ||
                            LM_DEFAULT_ABS_TOLERANCE);
        var relTolerance = (opts.relTolerance ||
                            LM_DEFAULT_REL_TOLERANCE);
        var maxIterations = (opts.maxIterations ||
                             LM_DEFAULT_MAX_ITERATIONS);

        var Rinv = 10;
        var lamb = 0.1;

        var x = Matrix.columnVectorFromList(x0);
        var yhat = f(x.tolist());
        var error = diff(y, yhat);
        var normStart = error.meanNorm();

        var done = false;
        var status = null;

        // Solution may already be good enough
        if (normStart < absTolerance) {
            status = LM_CONVERGED_ABS_TOLERANCE;
            done = True;
        }

        var outerIterations = 0;
        while (!done) {
            var shortCircuit = false;

            console.log('outerIterations=' + outerIterations + ' x=' + x);
            outerIterations++;

            // Compute the value, derivative, and hessian of the cost function
            // at the current point.  These remain valid until the parameter
            // vector changes.

            // expected measurement with new x
            yhat = f(x.tolist());

            // Difference between observed and predicted and error
            // (2-norm of difference)
            error = diff(y, yhat);
            normStart = error.meanNorm();
            console.log('outer iteration starting robust norm=' + normStart);

            var J = jacobian(x);

            var delJ = (J.transpose()
                        .multiply(error)
                        .multiply(-Rinv));
            // Hessian of cost function (using Gauss-Newton approximation)
            var hessian = (J.transpose()
                           .multiply(J)
                           .multiply(Rinv));

            var iterations = 0;
            var normTry = normStart + 1.0;
            while (normTry > normStart) {
                // Increase diagonal elements to dynamically mix gradient
                // descent and Gauss-Newton.
                var hessianLm = hessian;
                for (var i = 0; i < hessianLm.h; i++) {
                    hessianLm.values[i][i] += (hessianLm.values[i][i] *
                                               lamb + lamb);
                }

                // Solve for update
                var deltaX = linearLeastSquares(delJ, hessianLm);
                console.log('J=' + J);
                console.log('hessianLm=' + hessianLm);
                console.log('deltaX=' + deltaX.transpose());
                console.log('delJ=' + delJ);
                console.log('delJApprox=' + hessianLm.multiply(deltaX));

                // update parameter vector
                var xTry = x.subtract(deltaX);
                var yTry = f(xTry.tolist());
                var errorTry = diff(y, yTry);
                var normTry = errorTry.meanNorm();

                console.log('iteration ' + iterations +
                            ' norm ' + normTry);

                if (normTry > normStart) {
                    // Increase lambda and try again
                    lamb *= 10;
                }

                iterations++;

                // Sanity check on iterations in this loop
                if (iterations > 5) {
                    console.log('too many iterations - short circuiting');
                    shortCircuit = true;
                    normTry = normStart;
                    console.log('lambda=' + lamb);
                }
            }

            // Percentage change convergence criterion
            console.log('normStart=' + normStart +
                        ' normTry=' + normTry +
                        ' relTolerance=' + relTolerance);
            if (((normStart - normTry) / normStart) < relTolerance) {
                status = LM_CONVERGED_REL_TOLERANCE;
                console.log('converged to relative tolerance');
                done = true;
            }

            // Absolute error convergence criterion
            if (normTry < absTolerance) {
                status = LM_CONVERGED_ABS_TOLERANCE;
                console.log('converged to absolute tolerance');
                done = true;
            }

            // Max iterations convergence criterion
            if (outerIterations >= maxIterations) {
                status = LM_DID_NOT_CONVERGE;
                console.log('reached max iterations!');
                done = true;
            }

            // Take trial parameters as new parameters. If we
            // short-circuited the inner loop, then we didn't actually
            // find a better p, so don't update it.
            if (!shortCircuit) {
                x = xTry;
            }

            // Take trial error as new error
            normStart = normTry;

            // Decrease lambda
            lamb /= 10;
            console.log('lambda = %s', lamb);
            console.log('end of outer iteration ' + outerIterations +
                        ' with error ' + normTry);
        }

        console.log('finished after iteration ' + outerIterations +
                    ' error=' + normTry);
        return [x.tolist(), status];
    }

    /**********************************************************************
     * exports
     **********************************************************************/

    var ns = geocamTiePoint.optimize;

    ns.linearLeastSquares = linearLeastSquares;
    ns.lm = lm;

})();
