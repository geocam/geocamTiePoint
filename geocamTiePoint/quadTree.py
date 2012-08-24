# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Imports are copied from the old views.py,
# so I'm basically taking a wild guess at what's required.
import json
import os
import math
import sys
import time
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

from django.http import HttpResponse

from PIL import Image
import numpy
import numpy.linalg

import geocamTiePoint.optimize
from geocamTiePoint import settings

TILE_SIZE = 256.
PATCH_SIZE = 32
PATCHES_PER_TILE = int(TILE_SIZE / PATCH_SIZE)
PATCH_ZOOM_OFFSET = math.log(PATCHES_PER_TILE, 2)
INITIAL_RESOLUTION = 2 * math.pi * 6378137 / TILE_SIZE
ORIGIN_SHIFT = 2 * math.pi * (6378137 / 2.)
ZOOM_OFFSET = 3
BENCHMARK_WARP_STEPS = False
BLACK = (0, 0, 0)

class ZoomTooBig(Exception):
    pass


class OutOfBounds(Exception):
    pass


class Bounds(object):
    def __init__(self, points=None):
        self.bounds = [None, None, None, None]
        if points:
            for point in points:
                self.extend(point)

    def __getattribute__(self, name):
        if name == 'xmin':
            return self.bounds[0]
        elif name == 'xmax':
            return self.bounds[2]
        elif name == 'ymin':
            return self.bounds[1]
        elif name == 'ymax':
            return self.bounds[3]
        else:
            return object.__getattribute__(self, name)

    def extend(self, point):
        if self.bounds[0] == None:
            self.bounds[0] = point[0]
        if self.bounds[1] == None:
            self.bounds[1] = point[1]
        if self.bounds[2] == None:
            self.bounds[2] = point[0]
        if self.bounds[3] == None:
            self.bounds[3] = point[1]
        self.bounds[0] = min(self.bounds[0], point[0])
        self.bounds[1] = min(self.bounds[1], point[1])
        self.bounds[2] = max(self.bounds[2], point[0])
        self.bounds[3] = max(self.bounds[3], point[1])


def splitArray(array, by):
    by = int(by)
    assert(by > 1)
    newArray = []
    for i in range(0, int(float(len(array)) / by) + 1, by):
        newArray.append(array[i:(i + by)])
    return newArray


def testOutsideCorners(point, corners):
    x, y = point
    upperLeft, upperRight, lowerLeft, lowerRight = corners

    left = min(upperLeft[0], lowerLeft[0])
    right = max(upperRight[0], lowerRight[0])
    top = min(upperLeft[1], upperRight[1])
    bottom = max(lowerLeft[1], lowerRight[1])

    inside = ((left <= x <= right)
              and (top <= y <= bottom))
    return not inside


def allPointsOutsideCorners(points, corners):
    return all([testOutsideCorners(p, corners) for p in points])


def cornerPoints(bounds):
    left, top, right, bottom = bounds
    return ((left, top),
            (right, top),
            (left, bottom),
            (right, bottom))


def getImageCorners(image):
    w, h = image.size
    return ((0, 0),
            (w, 0),
            (0, h),
            (w, h))


def calculateMaxZoom(bounds, image):
    metersPerPixelX = (bounds.xmax - bounds.xmin) / image.size[0]
    metersPerPixelY = (bounds.ymax - bounds.ymin) / image.size[1]
    metersPerPixel = min(metersPerPixelX, metersPerPixelY)
    assert metersPerPixel > 0
    decimalZoom = math.log((INITIAL_RESOLUTION / metersPerPixel), 2)
    zoom = int(math.ceil(decimalZoom))
    return zoom + settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION


def tileIndex(zoom, mercatorCoords):
    coords = metersToPixels(mercatorCoords[0], mercatorCoords[1], zoom)
    index = [int(math.floor(coord / (TILE_SIZE))) for coord in coords]
    return index


def tileExtent(zoom, x, y):
    corners = ((x, y),
               (x, y + 1),
               (x + 1, y + 1),
               (x + 1, y))
    pixelCorners = [tileIndexToPixels(*corner) for corner in corners]
    mercatorCorners = [pixelsToMeters(*(pixels + (zoom,))) for pixels in pixelCorners]
    return mercatorCorners


def tileIndexToPixels(x, y):
    return x * TILE_SIZE, y * TILE_SIZE


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


def applyProjectiveTransform(matrix, pt):
    print >> sys.stderr, pt
    u = numpy.array(list(pt) + [1], 'd')
    v0 = matrix.dot(u)
    # projective rescaling: divide by z and truncate
    v = (v0 / v0[2])[:2]
    return v.tolist()


class ProjectiveTransform(object):
    def __init__(self, matrix):
        self.matrix = numpy.array(matrix)
        self.inverse = getProjectiveInverse(self.matrix)

    def _apply(self, matrix, pt):
        u = numpy.array(list(pt) + [1], 'd')
        v0 = matrix.dot(u)
        # projective rescaling: divide by z and truncate
        v = (v0 / v0[2])[:2]
        return v.tolist()

    def forward(self, pt):
        return self._apply(self.matrix, pt)

    def reverse(self, pt):
        return self._apply(self.inverse, pt)


class QuadraticTransform(object):
    def __init__(self, matrix):
        self.matrix = numpy.array(matrix)

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

        # run levenberg-marquardt to get an exact inverse.
        umin, _status = (geocamTiePoint.optimize.lm
                         (v,
                          lambda u: numpy.array(self.forward(u)),
                          numpy.array(u0)))

        return umin.tolist()


def makeTransform(transformDict):
    transformType = transformDict['type']
    transformMatrix = transformDict['matrix']
    if transformType == 'projective':
        return ProjectiveTransform(transformMatrix)
    elif transformType == 'quadratic':
        return QuadraticTransform(transformMatrix)
    else:
        raise ValueError('unknown transform type %s, expected one of: projective, quadratic'
                         % transformType)


def flatten(listOfLists):
    return [item for subList in listOfLists for item in subList]


def getImageResponsePng(image):
    out = StringIO()
    image.save(out, format='png')
    return HttpResponse(out.getvalue(), mimetype='image/png')


def setBackgroundColor(image, backgroundColor):
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    background = Image.new('RGB', image.size, backgroundColor)
    alpha = image.split()[3]
    background.paste(image, mask=alpha)
    return background


def getImageResponseJpg(image):
    out = StringIO()
    image = setBackgroundColor(image, BLACK)
    image.save(out, format='jpeg')
    return HttpResponse(out.getvalue(), mimetype='image/jpeg')


def resolution(zoom):
    return INITIAL_RESOLUTION / (2 ** zoom)


def lonLatToMeters(lonLat):
    lon, lat = lonLat
    mx = lon * ORIGIN_SHIFT / 180
    my = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180)
    my = my * ORIGIN_SHIFT / 180
    return mx, my


def metersToLatLon(mercatorPt):
    x, y = mercatorPt
    lon = x * 180 / ORIGIN_SHIFT
    lat = y * 180 / ORIGIN_SHIFT
    lat = ((math.atan(math.exp((lat * (math.pi / 180)))) * 360) / math.pi) - 90
    return lon, lat


def pixelsToMeters(x, y, zoom):
    res = resolution(zoom)
    mx = (x * res) - ORIGIN_SHIFT
    my = -(y * res) + ORIGIN_SHIFT
    return [mx, my]


def metersToPixels(x, y, zoom):
    res = resolution(zoom)
    px = (x + ORIGIN_SHIFT) / res
    py = (-y + ORIGIN_SHIFT) / res
    return [px, py]


def imageMapBounds(imageSize, transform):
    w, h = imageSize
    imageCorners = cornerPoints([0, 0, w, h])
    mercatorCorners = [transform.forward(c) for c in imageCorners]
    latLonCorners = [metersToLatLon(c) for c in mercatorCorners]
    bounds = Bounds(latLonCorners)
    return {'west': bounds.xmin,
            'south': bounds.ymin,
            'east': bounds.xmax,
            'north': bounds.ymax}


class SimpleQuadTreeGenerator(object):
    def __init__(self, image):
        self.imageSize = image.size
        w, h = self.imageSize
        self.coords = ((0, 0),
                       (w, 0),
                       (0, h),
                       (w, h))

        if self.imageSize[0] > self.imageSize[1]:
            self.maxZoom0 = int(math.ceil(math.log(self.imageSize[0] / TILE_SIZE, 2)))
        else:
            self.maxZoom0 = int(math.ceil(math.log(self.imageSize[1] / TILE_SIZE, 2)))
        k = settings.GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION
        self.maxZoom = self.maxZoom0 + k

        self.zoomedImage = {}
        self.zoomedImage[self.maxZoom0] = image
        self.zoomedImage[self.maxZoom] = image.resize((image.size[0] * 2 ** k,
                                                       image.size[1] * 2 ** k),
                                                      Image.BICUBIC)

    def getZoomedImage(self, zoom):
        result = self.zoomedImage.get(zoom, None)
        if result is None:
            image = self.getZoomedImage(zoom + 1)
            result = image.resize((int(math.ceil(image.size[0] / 2.)),
                                   int(math.ceil(image.size[1] / 2.))),
                                  Image.ANTIALIAS)
            self.zoomedImage[zoom] = result
        return result

    def writeQuadTree(self, basePath):
        for zoom in xrange(self.maxZoom, -1, -1):
            nx = int(math.ceil(self.imageSize[0] / TILE_SIZE))
            ny = int(math.ceil(self.imageSize[1] / TILE_SIZE))
            for x in xrange(nx):
                for y in xrange(ny):
                    zoom0 = zoom + ZOOM_OFFSET
                    try:
                        self.writeTile(basePath, zoom0, x, y)
                    except OutOfBounds:
                        # no surprise if some tiles are empty around the edges
                        pass

    def writeTile(self, basePath, zoom0, x, y):
        tileData = self.generateTile(zoom0, x, y)

        tilePath = basePath + '/%s/%s/%s.jpg' % (zoom0, x, y)
        tileDir = os.path.dirname(tilePath)
        if not os.path.exists(tileDir):
            os.makedirs(tileDir)
        tileData.save(tilePath)

    def getTileResponse(self, zoom0, x, y):
        return getImageResponseJpg(self.generateTile(zoom0, x, y))

    def generateTile(self, zoom0, x, y):
        zoom = zoom0 - ZOOM_OFFSET

        if zoom > self.maxZoom:
            raise ZoomTooBig("can't generate tiles with zoom %d > maximum of %d"
                             % (zoom0, self.maxZoom + ZOOM_OFFSET))

        tileBounds = [TILE_SIZE * x,
                      TILE_SIZE * y,
                      TILE_SIZE * (x + 1),
                      TILE_SIZE * (y + 1)]
        tileBounds = [int(round(c)) for c in tileBounds]
        image = self.getZoomedImage(zoom)
        if allPointsOutsideCorners(cornerPoints(tileBounds), getImageCorners(image)):
            raise OutOfBounds("tile at zoom=%d, x=%d, y=%d is out of the image bounds"
                              % (zoom0, x, y))

        return image.crop(tileBounds)


class WarpedQuadTreeGenerator(object):
    def __init__(self, image, transformDict):
        self.image = image
        self.transform = makeTransform(transformDict)

        corners = getImageCorners(self.image)
        self.mercatorCorners = [self.transform.forward(corner)
                                for corner in corners]

        if 0:
            # debug getProjectiveInverse
            print >> sys.stderr, 'mercatorCorners:', self.mercatorCorners
            corners2 = [self.transform.reverse(corner)
                        for corner in self.mercatorCorners]
            print >> sys.stderr, 'zip:', zip(corners, corners2)
            for i, pair in enumerate(zip(corners, corners2)):
                c1, c2 = pair
                print >> sys.stderr, i, numpy.array(c1) - numpy.array(c2)

        bounds = Bounds()
        for corner in self.mercatorCorners:
            bounds.extend(corner)

        self.maxZoom = calculateMaxZoom(bounds, self.image)

        self.tileBounds = [None] * (self.maxZoom + 1)
        for zoom in xrange(int(self.maxZoom), -1, -1):
            tbounds = Bounds()
            for corner in self.mercatorCorners:
                tileCoords = tileIndex(zoom, corner)
                tbounds.extend(tileCoords)
            self.tileBounds[zoom] = tbounds

    def writeQuadTree(self, basePath):
        print >> sys.stderr, 'warping...'
        totalTiles = 0
        startTime = time.time()
        for zoom in xrange(int(self.maxZoom), -1, -1):
            xmin, ymin, xmax, ymax = self.tileBounds[zoom].bounds
            maxNumTiles = (xmax - xmin + 1) * (ymax - ymin + 1)
            totalTiles += maxNumTiles
            sys.stderr.write('zoom %d: generating %d tiles' % (zoom, maxNumTiles))
            for x in xrange(int(xmin), int(xmax) + 1):
                for y in xrange(int(ymin), int(ymax) + 1):
                    try:
                        self.writeTile(basePath, zoom, x, y)
                    except OutOfBounds:
                        # no surprise if some tiles are empty around the edges
                        pass
            sys.stderr.write('\n')

        elapsedTime = time.time() - startTime
        print >> sys.stderr, ('warping complete: %d tiles, elapsed time %.1f seconds = %d ms/tile'
                              % (totalTiles, elapsedTime, int(1000 * elapsedTime / totalTiles)))

    def writeTile(self, basePath, zoom, x, y):
        tileData = self.generateTile(zoom, x, y)

        if BENCHMARK_WARP_STEPS:
            saveStart = time.time()
        tilePath = basePath + '/%s/%s/%s.png' % (zoom, x, y)
        tileDir = os.path.dirname(tilePath)
        if not os.path.exists(tileDir):
            os.makedirs(tileDir)
        tileData.save(tilePath)
        if BENCHMARK_WARP_STEPS:
            print 'saveTime:', time.time() - saveStart

    def getTileResponse(self, zoom, x, y):
        return getImageResponsePng(self.generateTile(zoom, x, y))

    def generateTile(self, zoom, x, y):
        if zoom > self.maxZoom:
            raise ZoomTooBig("can't generate tiles with zoom %d > maximum of %d"
                             % (zoom, self.maxZoom))

        xmin, ymin, xmax, ymax = self.tileBounds[zoom].bounds
        if (not ((xmin <= x <= xmax)
                 and (ymin <= y <= ymax))):
            raise OutOfBounds("tile at zoom=%d, x=%d, y=%d is out of the image bounds"
                              % (zoom, x, y))

        sys.stderr.write('.')

        if isinstance(self.transform, ProjectiveTransform):
            transformArgs = self.getPilTransformArgsProjective(zoom, x, y)
        else:
            transformArgs = self.getPilTransformArgsQuadratic(zoom, x, y)

        if BENCHMARK_WARP_STEPS:
            warpDataStart = time.time()
        tileData = self.image.transform(*transformArgs)
        if BENCHMARK_WARP_STEPS:
            print 'warpDataTime:', time.time() - warpDataStart

        if BENCHMARK_WARP_STEPS:
            resizeStart = time.time()
        tileData = tileData.resize((int(TILE_SIZE),) * 2, Image.ANTIALIAS)
        if BENCHMARK_WARP_STEPS:
            print 'resizeTime:', time.time() - resizeStart

        return tileData

    def getPilTransformArgsProjective(self, zoom, x, y):
        corners = tileExtent(zoom, x, y)
        sourceCorners = [[int(round(c))
                          for c in self.transform.reverse(corner)]
                         for corner in corners]

        return ((int(TILE_SIZE * 2),) * 2,
                Image.QUAD,
                flatten(sourceCorners),
                Image.BICUBIC)

    def getPilTransformArgsQuadratic(self, zoom, x, y):
        corners = tileExtent(zoom, x, y)

        if BENCHMARK_WARP_STEPS:
            transformStart = time.time()
        doublePatchSize = PATCH_SIZE * 2
        meshPatches = []

        patchTable = {}
        for px in xrange(PATCHES_PER_TILE + 1):
            for py in xrange(PATCHES_PER_TILE + 1):
                targetPatchOrigin = tileIndexToPixels(x * PATCHES_PER_TILE + px,
                                                      y * PATCHES_PER_TILE + py)
                mercatorPatchOrigin = pixelsToMeters(targetPatchOrigin[0],
                                                     targetPatchOrigin[1],
                                                     zoom + PATCH_ZOOM_OFFSET)
                sourcePatchOrigin = [int(round(c))
                                     for c in self.transform.reverse(mercatorPatchOrigin)]
                patchTable[(px, py)] = sourcePatchOrigin
        if BENCHMARK_WARP_STEPS:
            print
            print 'transformTime:', time.time() - transformStart

        if BENCHMARK_WARP_STEPS:
            meshStart = time.time()
        for px in xrange(PATCHES_PER_TILE):
            for py in xrange(PATCHES_PER_TILE):
                corners = ((px, py),
                           (px, py + 1),
                           (px + 1, py + 1),
                           (px + 1, py))
                sourcePatchCorners = [patchTable[corner]
                                      for corner in corners]
                xoff = px * doublePatchSize
                yoff = py * doublePatchSize
                targetBox = (xoff,
                             yoff,
                             xoff + doublePatchSize,
                             yoff + doublePatchSize)
                meshPatches.append([targetBox, flatten(sourcePatchCorners)])

                if 0:
                    print >> sys.stderr, 'patchCorners:', corners
                    print >> sys.stderr, 'sourceCorners:', sourcePatchCorners
                    print >> sys.stderr, 'targetBox:', targetBox

        transformArgs = ((int(TILE_SIZE * 2),) * 2,
                         Image.MESH,
                         meshPatches,
                         Image.BICUBIC)

        if 0:
            print >> sys.stderr, 'meshPatches:'
            print >> sys.stderr, json.dumps(meshPatches, indent=4)
        if BENCHMARK_WARP_STEPS:
            print 'meshTime:', time.time() - meshStart

        return transformArgs
