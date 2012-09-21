// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

if (! window.geocamTiePoint) { window.geocamTiePoint = {}; }

geocamTiePoint.optimize = {};

(function() {

    function linearLeastSquares(V, U) {
        var tmp = U.transpose().multiply(V);
        return U.transpose().multiply(U).invert().multiply(tmp);
    }

    // default arguments
    var LM_DEFAULT_ABS_TOLERANCE = 1e-16;
    var LM_DEFAULT_REL_TOLERANCE = 1e-16;
    var LM_DEFAULT_MAX_ITERATIONS = 100;

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


    var lmLog = function() {};
    // var lmLog = console.log;

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

            lmLog('outerIterations=' + outerIterations + ' x=' + x);
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
            lmLog('outer iteration starting robust norm=' + normStart);

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

                // update parameter vector
                var xTry = x.subtract(deltaX);
                var yTry = f(xTry.tolist());
                var errorTry = diff(y, yTry);
                var normTry = errorTry.meanNorm();

                lmLog('iteration ' + iterations +
                      ' norm ' + normTry);

                if (normTry > normStart) {
                    // Increase lambda and try again
                    lamb *= 10;
                }

                iterations++;

                // Sanity check on iterations in this loop
                if (iterations > 5) {
                    lmLog('too many iterations - short circuiting');
                    shortCircuit = true;
                    normTry = normStart;
                    lmLog('lambda=' + lamb);
                }
            }

            // Percentage change convergence criterion
            lmLog('normStart=' + normStart +
                  ' normTry=' + normTry +
                  ' relTolerance=' + relTolerance);
            if (((normStart - normTry) / normStart) < relTolerance) {
                status = LM_CONVERGED_REL_TOLERANCE;
                lmLog('converged to relative tolerance');
                done = true;
            }

            // Absolute error convergence criterion
            if (normTry < absTolerance) {
                status = LM_CONVERGED_ABS_TOLERANCE;
                lmLog('converged to absolute tolerance');
                done = true;
            }

            // Max iterations convergence criterion
            if (outerIterations >= maxIterations) {
                status = LM_DID_NOT_CONVERGE;
                lmLog('reached max iterations!');
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
            lmLog('lambda = %s', lamb);
            lmLog('end of outer iteration ' + outerIterations +
                        ' with error ' + normTry);
        }

        lmLog('finished after iteration ' + outerIterations +
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
