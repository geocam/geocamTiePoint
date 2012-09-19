# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# warnings about undefined variables within closures
# pylint: disable=E1120

# warnings about not calling parent class constructor
# pylint: disable=W0231

# warnings about not defining abstract methods from parent
# pylint: disable=W0223

import math

import numpy

from geocamTiePoint.optimize import optimize


def getProjectiveInverse(matrix):
    # http://www.cis.rit.edu/class/simg782/lectures/lecture_02/lec782_05_02.pdf (p. 33)
    c0 = matrix[0, 0]
    c1 = matrix[0, 1]
    c2 = matrix[0, 2]
    c3 = matrix[1, 0]
    c4 = matrix[1, 1]
    c5 = matrix[1, 2]
    c6 = matrix[2, 0]
    c7 = matrix[2, 1]
    result = numpy.array([[c4 - c5 * c7,
                           c2 * c7 - c1,
                           c1 * c5 - c2 * c4],
                          [c5 * c6 - c3,
                           c0 - c2 * c6,
                           c3 * c2 - c0 * c5],
                          [c3 * c7 - c4 * c6,
                           c1 * c6 - c0 * c7,
                           c0 * c4 - c1 * c3]])

    # normalize just for the hell of it
    result /= result[2, 2]

    return result


def closest(tgt, vals):
    return min(vals, key=lambda v: abs(tgt - v))


def solveQuad(a, p):
    """
    Solve p = x + a x^2 for x. Over the region of interest there should
    generally be two real roots with one much closer to p than the
    other, and we prefer that one.
    """

    if a * a > 1e-20:
        discriminant = 4 * a * p + 1
        if discriminant < 0:
            return None
        h = math.sqrt(discriminant)
        roots = [(-1 + h) / (2 * a),
                 (-1 - h) / (2 * a)]
        return closest(p, roots)
    else:
        # avoid divide by zero
        return p


class Transform(object):
    @classmethod
    def fit(cls, toPts, fromPts):
        params0 = cls.getInitParams(toPts, fromPts)
        params = optimize(toPts.flatten(),
                          lambda params: forwardPts(cls.fromParams(params), fromPts).flatten(),
                          params0)
        return cls.fromParams(params)

    @classmethod
    def getInitParams(cls, toPts, fromPts):
        raise NotImplementedError('implement in derived class')

    @classmethod
    def fromParams(cls, params):
        raise NotImplementedError('implement in derived class')


class LinearTransform(Transform):
    def __init__(self, matrix):
        self.matrix = matrix
        self.inverse = None

    def forward(self, pt):
        u = numpy.array(list(pt) + [1], dtype='float64')
        v = self.matrix.dot(u)
        return v[:2].tolist()

    def reverse(self, pt):
        if self.inverse is None:
            self.inverse = numpy.linalg.inv(self.matrix)
        v = numpy.array(list(pt) + [1], dtype='float64')
        u = self.inverse.dot(v)
        return u[:2].tolist()

    def getJsonDict(self):
        return {'type': 'projective',
                'matrix': self.matrix.tolist()}


class TranslateTransform(LinearTransform):
    @classmethod
    def fit(cls, toPts, fromPts):
        meanDiff = (numpy.mean(toPts, axis=0) -
                    numpy.mean(fromPts, axis=0))
        tx, ty = meanDiff

        matrix = numpy.array([[1, 0, tx],
                              [0, 1, ty],
                              [0, 0, 1]],
                             dtype='float64')
        return cls(matrix)


class RotateScaleTranslateTransform(LinearTransform):
    @classmethod
    def fromParams(cls, params):
        tx, ty, scale, theta = params
        translateMatrix = numpy.array([[1, 0, tx],
                                       [0, 1, ty],
                                       [0, 0, 1]],
                                      dtype='float64')
        scaleMatrix = numpy.array([[scale, 0, 0],
                                   [0, scale, 0],
                                   [0, 0, 1]],
                                  dtype='float64')
        rotateMatrix = numpy.array([[math.cos(theta), -math.sin(theta), 0],
                                    [math.sin(theta), math.cos(theta), 0],
                                    [0, 0, 1]],
                                   dtype='float64')
        matrix = translateMatrix.dot(scaleMatrix).dot(rotateMatrix)
        return cls(matrix)

    @classmethod
    def getInitParams(cls, toPts, fromPts):
        tmat = AffineTransform.fit(toPts, fromPts).matrix
        tx = tmat[0, 2]
        ty = tmat[1, 2]
        scale = tmat[0, 0] * tmat[1, 1] - tmat[1, 0] * tmat[0, 1]
        theta = math.atan2(-tmat[0, 1], tmat[0, 0])
        return [tx, ty, scale, theta]


class AffineTransform(LinearTransform):
    @classmethod
    def fit(cls, toPts, fromPts):
        n = toPts.shape[0]
        V = numpy.zeros((2 * n, 1))
        U = numpy.zeros((2 * n, 6))
        for i in xrange(0, n):
            V[2 * i, 0] = toPts[i, 0]
            V[2 * i + 1, 0] = toPts[i, 1]
            U[2 * i, 0:3] = fromPts[i, 0], fromPts[i, 1], 1
            U[2 * i + 1, 3:6] = fromPts[i, 0], fromPts[i, 1], 1
        soln, _residues, _rank, _sngVals = numpy.linalg.lstsq(U, V)
        params = soln[:, 0]
        #print 'params:', params
        matrix = numpy.array([[params[0], params[1], params[2]],
                              [params[3], params[4], params[5]],
                              [0, 0, 1]],
                             dtype='float64')
        return cls(matrix)


class ProjectiveTransform(Transform):
    def __init__(self, matrix):
        self.matrix = matrix
        self.inverse = None

    def _apply(self, matrix, pt):
        u = numpy.array(list(pt) + [1], 'd')
        v0 = matrix.dot(u)
        # projective rescaling: divide by z and truncate
        v = (v0 / v0[2])[:2]
        return v.tolist()

    def forward(self, pt):
        return self._apply(self.matrix, pt)

    def reverse(self, pt):
        if self.inverse is None:
            self.inverse = getProjectiveInverse(self.matrix)
        return self._apply(self.inverse, pt)

    @classmethod
    def fromParams(cls, params):
        matrix = numpy.append(params, 1).reshape((3, 3))
        return cls(matrix)

    @classmethod
    def getInitParams(cls, toPts, fromPts):
        tmat = AffineTransform.fit(toPts, fromPts).matrix
        return tmat.flatten()[:8]


class QuadraticTransform(Transform):
    def __init__(self, matrix):
        self.matrix = matrix

        # there's a projective transform hiding in the quadratic
        # transform if we drop the first two columns. we use it to
        # estimate an initial value when calculating the inverse.
        self.proj = ProjectiveTransform(self.matrix[:, 2:])

    def _residuals(self, v, u):
        vapprox = self.forward(u)
        return (vapprox - v)

    def forward(self, ulist):
        u = numpy.array([ulist[0] ** 2, ulist[1] ** 2, ulist[0], ulist[1], 1])
        v0 = self.matrix.dot(u)
        v = (v0 / v0[2])[:2]
        return v.tolist()

    def reverse(self, vlist):
        v = numpy.array(vlist)

        # to get a rough initial value, apply the inverse of the simpler
        # projective transform. this will give the exact answer if the
        # quadratic terms happen to be 0.
        u0 = self.proj.reverse(vlist)

        # optimize to get an exact inverse.
        umin = optimize(v,
                        lambda u: numpy.array(self.forward(u)),
                        numpy.array(u0))

        return umin.tolist()

    def getJsonDict(self):
        return {'type': 'quadratic',
                'matrix': self.matrix.tolist()}

    @classmethod
    def fromParams(cls, params):
        matrix = numpy.zeros((3, 5))
        matrix[0, :] = params[0:5]
        matrix[1, :] = params[5:10]
        matrix[2, 2:4] = params[10:12]
        matrix[2, 4] = 1
        return cls(matrix)

    @classmethod
    def getInitParams(cls, toPts, fromPts):
        tmat = AffineTransform.fit(toPts, fromPts).matrix
        params = numpy.zeros(12)
        params[2:5] = tmat[0, :]
        params[7:10] = tmat[1, :]
        params[10:12] = tmat[2, 0:2]
        return params


class QuadraticTransform2(Transform):
    def __init__(self, matrix, quadraticTerms):
        self.matrix = matrix
        self.quadraticTerms = quadraticTerms
        self.projInverse = None

    def forward(self, ulist):
        u = numpy.array(list(ulist) + [1])
        v0 = self.matrix.dot(u)
        v1 = (v0 / v0[2])[:2]

        x, y = v1
        a, b, c, d = self.quadraticTerms

        p = x + a * x * x
        q = y + b * y * y
        r = p + c * q * q
        s = q + d * r * r

        return [r, s]

    def reverse(self, vlist):
        if self.projInverse is None:
            self.projInverse = getProjectiveInverse(self.matrix)

        v = numpy.array(list(vlist) + [1])

        r, s = v[:2]
        a, b, c, d = self.quadraticTerms

        q = s - d * r * r
        p = r - c * q * q
        x0 = solveQuad(a, p)
        if x0 is None:
            return None
        y0 = solveQuad(b, q)
        if y0 is None:
            return None

        v0 = numpy.array([x0, y0, 1])
        u0 = self.projInverse.dot(v0)
        x, y = (u0 / u0[2])[:2]

        return [x, y]

    def getJsonDict(self):
        return {'type': 'quadratic2',
                'matrix': self.matrix.tolist(),
                'quadraticTerms': list(self.quadraticTerms)}

    @classmethod
    def fromParams(cls, params):
        matrix = numpy.append(params[:8], 1).reshape((3, 3))
        quadTerms = params[8:]
        return cls(matrix, quadTerms)

    @classmethod
    def getInitParams(cls, toPts, fromPts):
        tmat = AffineTransform.fit(toPts, fromPts).matrix
        return numpy.append(tmat.flatten()[:8],
                            numpy.zeros(4))


def makeTransform(transformDict):
    transformType = transformDict['type']
    transformMatrix = numpy.array(transformDict['matrix'])
    if transformType == 'projective':
        return ProjectiveTransform(transformMatrix)
    elif transformType == 'quadratic':
        return QuadraticTransform(transformMatrix)
    elif transformType == 'quadratic2':
        return QuadraticTransform2(transformMatrix,
                                   transformDict['quadraticTerms'])
    else:
        raise ValueError('unknown transform type %s, expected one of: projective, quadratic'
                         % transformType)


def forwardPts(tform, fromPts):
    toPts = numpy.zeros(fromPts.shape)
    for i, pt in enumerate(fromPts):
        toPts[i, :] = tform.forward(pt)
    return toPts


def getTransformClass(n):
    if n < 2:
        raise ValueError('not enough tie points')
    elif n == 2:
        return RotateScaleTranslateTransform
    elif n == 3:
        return AffineTransform
    elif n < 7:
        return ProjectiveTransform
    else:
        return QuadraticTransform2


def getTransform(toPts, fromPts):
    n = toPts.shape[0]
    cls = getTransformClass(n)
    return cls.fit(toPts, fromPts)


def splitPoints(points):
    toPts = numpy.array([v[0:2] for v in points])
    fromPts = numpy.array([v[2:4] for v in points])
    return toPts, fromPts
