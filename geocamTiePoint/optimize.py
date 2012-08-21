# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Levenberg-Marquardt optimization algorithm. This is a Python adaptation of
the C++ L-M implementation from the NASA Vision Workbench.
"""

import logging

import numpy
from numpy.linalg import norm

# default arguments
LM_DEFAULT_ABS_TOLERANCE = 1e-16
LM_DEFAULT_REL_TOLERANCE = 1e-16
LM_DEFAULT_MAX_ITERATIONS = 100

# status values
LM_DID_NOT_CONVERGE = -1
LM_STATUS_UNKNOWN = 0
LM_CONVERGED_ABS_TOLERANCE = 1
LM_CONVERGED_REL_TOLERANCE = 2


def numericalJacobian(f):
    """
    Rather stupid numerical Jacobian used by default in lm(). Much better
    to supply an analytical Jacobian if you can.
    """
    def jacobian(x):
        k = len(x)
        y = f(x)
        n = len(y)
        result = numpy.zeros((n, k))
        for i in xrange(k):
            xp = x.copy()
            eps = 1e-7 + 1e-7 * x[i]
            xp[i] += eps
            yp = f(xp)
            result[:, i] = (yp - y) / eps
        return result

    return jacobian


def lm(y, f, x0,
       diff=lambda u, v: (u - v),
       jacobian=None,
       absTolerance=LM_DEFAULT_ABS_TOLERANCE,
       relTolerance=LM_DEFAULT_REL_TOLERANCE,
       maxIterations=LM_DEFAULT_MAX_ITERATIONS):
    """
    Use the Levenberg-Marquardt algorithm to calculate a local minimum
    x for the error function

      E = || diff(y, f(x)) || ** 2

    in the neighborhood of x0. The default diff function is simple
    subtraction.  You can improve numerical stability by providing an
    analytical jacobian for f.
    """
    logger = logging.getLogger('LM')

    Rinv = 10
    lamb = 0.1
    if jacobian is None:
        jacobian = numericalJacobian(f)

    x = x0
    yhat = f(x)
    error = diff(y, yhat)
    normStart = norm(error)

    # Solution may already be good enough
    done = (normStart < absTolerance)

    outerIterations = 0
    while not done:
        shortCircuit = False

        logger.debug('outerIterations=%s x=%s', outerIterations, x)
        outerIterations += 1

        # Compute the value, derivative, and hessian of the cost function
        # at the current point.  These remain valid until the parameter
        # vector changes.

        # expected measurement with new x
        yhat = f(x)

        # Difference between observed and predicted and error (2-norm of difference)
        error = diff(y, yhat)
        normStart = norm(error)
        logger.debug("outer iteration starting robust norm=%s", normStart)

        J = jacobian(x)

        delJ = -1.0 * Rinv * (J.transpose() * error)
        # Hessian of cost function (using Gauss-Newton approximation)
        hessian = Rinv * (J.transpose() * J)

        iterations = 0
        normTry = normStart + 1.0
        while normTry > normStart:
            # Increase diagonal elements to dynamically mix gradient
            # descent and Gauss-Newton.
            hessianLm = hessian
            for i in xrange(hessianLm.shape[0]):
                hessianLm[i, i] += hessianLm[i, i] * lamb + lamb

            # Solve for update
            soln, _residues, _rank, _sngVal = numpy.linalg.lstsq(hessianLm, delJ)
            deltaX = soln.diagonal()

            # update parameter vector
            xTry = x - deltaX
            yTry = f(xTry)
            errorTry = diff(y, yTry)
            normTry = norm(errorTry)

            logger.debug('iteration %s error %s norm %s', iterations, errorTry, normTry)

            if normTry > normStart:
                # Increase lambda and try again
                lamb *= 10

            iterations += 1  # Sanity check on iterations in this loop
            if iterations > 5:
                logger.debug('too many iterations - short circuiting')
                shortCircuit = True
                normTry = normStart
            logger.debug('lambda=%s', lamb)

        # Percentage change convergence criterion
        if ((normStart - normTry) / normStart) < relTolerance:
            status = LM_CONVERGED_REL_TOLERANCE
            logger.debug('CONVERGED TO RELATIVE TOLERANCE')
            done = True

        # Absolute error convergence criterion
        if normTry < absTolerance:
            status = LM_CONVERGED_ABS_TOLERANCE
            logger.debug('CONVERGED TO ABSOLUTE TOLERANCE')
            done = True

        # Max iterations convergence criterion
        if outerIterations >= maxIterations:
            status = LM_DID_NOT_CONVERGE
            logger.debug('REACHED MAX ITERATIONS!')
            done = True

        # Take trial parameters as new parameters
        # If we short-circuited the inner loop, then we didn't actually find a
        # better p, so don't update it.
        if not shortCircuit:
            x = xTry

        # Take trial error as new error
        normStart = normTry

        # Decrease lambda
        lamb /= 10
        logger.debug('lambda = %s', lamb)
        logger.debug('end of outer iteration %s with error %s', outerIterations, normTry)

    logger.debug('finished after iteration %s', outerIterations)
    return x, status


def test():
    logging.basicConfig(level=logging.DEBUG)

    f = lambda x: 2 * x
    jacobian = numericalJacobian(f)
    print jacobian(numpy.array([1, 2, 3], dtype='float64'))

    f = lambda x: (x - 5) ** 2
    y = numpy.zeros(3)
    x0 = numpy.zeros(3)
    x, _status = lm(y, f, x0)
    print x

    import scipy.optimize
    print scipy.optimize.leastsq(lambda x: y - f(x), x0)

if __name__ == '__main__':
    test()
