// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

if (! window.geocamTiepoint) { window.geocamTiepoint = {}; }

/* optimize.js exports the following to the geocamTiepoint namespace:
 * geocamTiepoint.minimize(fun, x0)
 * geocamTiepoint.linear_regression(V, U)
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

    geocamTiepoint.linear_regression = function linear_regression(V, U)
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

    var ncom;
    var pcom;
    var xicom;

    geocamTiepoint.minimize = function minimize(fun, x0) {
        ncom = 0;
        pcom = [];
        xicom = [];

        //matrix of unit vectors
        var xi = new Array(p.length);
        for (var i = 0; i < p.length; i++) {
            xi[i] = new Array(p.length);
            for (var j = 0; j < p.length; j++) {
                if (i == j) {
                    xi[i][j] = 1;
                } else {
                    xi[i][j] = 0;
                }
            }
        }
        var xiM = new Matrix(p.length, p.length, xi);
        var ftol = 0.001;

        return powell(fun, x0, xiM, ftol, ncom, pcom, xicom);
    }

})();
