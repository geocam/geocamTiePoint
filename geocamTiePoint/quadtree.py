# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Imports are copied from the old views.py, 
# so I'm basically taking a wild guess at what's required.
import json
import base64
import os
import math
import sys
import time
import tarfile

from PIL import Image

import numpy
import numpy.linalg
try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

try:
    from scipy.optimize import leastsq
except ImportError:
    pass  # only needed for quadratic model with many tie points

TILE_SIZE = 256.
PATCH_SIZE = 32
PATCHES_PER_TILE = int(TILE_SIZE / PATCH_SIZE)
PATCH_ZOOM_OFFSET = math.log(PATCHES_PER_TILE, 2)
INITIAL_RESOLUTION = 2 * math.pi * 6378137 / TILE_SIZE
ORIGIN_SHIFT = 2 * math.pi * (6378137 / 2.)
ZOOM_OFFSET = 3
BENCHMARK_WARP_STEPS = False


class Bounds(object):
    def __init__(self, *points):
        self.bounds = [None, None, None, None]
        for point in points:
            self.extend(point)
    
    def __getattribute__(self, name):
        if name == 'xmin': return self.bounds[0]
        elif name == 'xmax': return self.bounds[2]
        elif name == 'ymin': return self.bounds[1]
        elif name == 'ymax': return self.bounds[3]
        else: return object.__getattribute__(self, name)

    def extend(self, point):
        if self.bounds[0] == None:
            self.bounds[0] = point[0]
        if self.bounds[1] == None:
            self.bounds[1] = point[1]
        if self.bounds[2] == None:
            self.bounds[2] = point[0]
        if self.bounds[3] == None:
            self.bounds[3] = point[1]
        self.bounds[0] = min(self.bounds[0],point[0])
        self.bounds[1] = min(self.bounds[1],point[1])
        self.bounds[2] = max(self.bounds[2],point[0])
        self.bounds[3] = max(self.bounds[3],point[1])


def splitArray(array, by):
    by = int(by)
    assert(by > 1)
    newArray = []
    for i in range(0, int(float(len(array))/by)+1, by):
        newArray.append(array[i:i+by])
    return newArray

def testOutsideImage(point, coords):
    upperLeft, upperRight, lowerLeft, lowerRight = coords
    if point[0] < min(upperLeft[0], lowerLeft[0]):
        return True
    if point[1] < min(upperLeft[1], upperRight[1]):
        return True
    if point[0] > max(upperRight[0], lowerRight[0]):
        return True
    if point[1] > max(lowerLeft[1], lowerRight[1]):
        return True
    if point[0] > max(upperLeft[0], lowerLeft[0]) and\
            point[0] < min(upperRight[0], lowerRight[0]) and\
            point[1] > max(lowerLeft[1], lowerRight[1]) and\
            point[1] < min(upperRight[1], upperRight[1]):
        return False
    # just assuming it's in the image, even though it might not be
    return False

def calculateMaxZoom(bounds, image):
    metersPerPixelX = (bounds.xmax - bounds.xmin) / image.size[0]
    metersPerPixelY = (bounds.ymax - bounds.ymin) / image.size[1]
    metersPerPixel = min(metersPerPixelX, metersPerPixelY)
    assert metersPerPixel > 0
    decimalZoom = math.log((INITIAL_RESOLUTION / metersPerPixel), 2)
    zoom = int(math.ceil(decimalZoom))
    return zoom

def tileIndex(zoom, mercatorCoords):
    coords = metersToPixels(mercatorCoords[0], mercatorCoords[1], zoom)
    index = [int(math.floor(coord / (TILE_SIZE))) for coord in coords]
    return index

def tileExtent(zoom, x, y):
    corners = ((x,y),(x,y+1),(x+1,y+1),(x+1,y))
    pixelCorners = [tileIndexToPixels(*corner) for corner in corners]
    mercatorCorners = [pixelsToMeters(*(pixels + (zoom,))) for pixels in pixelCorners]
    return mercatorCorners

def tileIndexToPixels(x,y):
    return x*TILE_SIZE, y*TILE_SIZE

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
    u = numpy.array(pt + [1], 'd')
    v0 = matrix.dot(u)
    # projective rescaling: divide by z and truncate
    v = (v0 / v0[2])[:2]
    return v.tolist()

class ProjectiveTransform(object):
    def __init__(self, matrix):
        self.matrix = numpy.array(matrix)
        self.inverse = getProjectiveInverse(self.matrix)

    def _apply(self, matrix, pt):
        u = numpy.array(pt + [1], 'd')
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
        u = numpy.array([ulist[0]**2, ulist[1]**2, ulist[0], ulist[1], 1])
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
        try:
            leastsq
        except NameError:
            raise ImportError('scipy.optimize.leastsq')
        umin, error = leastsq(lambda u: self._residuals(v, u),
                              u0)

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

def makeQuadTree(image, coords, basePath, storage):
    if image.size[0] > image.size[1]:
        maxZoom = int(math.ceil(math.log(image.size[0]/TILE_SIZE,2)))
    else:
        maxZoom = int(math.ceil(math.log(image.size[1]/TILE_SIZE,2)))
    for i in xrange(maxZoom, -1, -1):
        nx = int(math.ceil(image.size[0]/TILE_SIZE))
        ny = int(math.ceil(image.size[1]/TILE_SIZE))
        tile_keys = []
        for ix in xrange(nx):
            for iy in xrange(ny):
                if testOutsideImage((TILE_SIZE*ix,TILE_SIZE*iy),coords) and\
                        testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*iy),coords) and\
                        testOutsideImage((TILE_SIZE*ix,TILE_SIZE*(iy+1)),coords) and\
                        testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)),coords):
                    continue
                tile_key = basePath+'/%s/%s/%s.jpg' % (i+ZOOM_OFFSET,ix,iy)
                if not os.path.exists(basePath+'/%s/%s/' % (i+ZOOM_OFFSET,ix)):
                    os.makedirs(basePath+'/%s/%s' % (i+ZOOM_OFFSET,ix))
                corners = [TILE_SIZE*ix,TILE_SIZE*iy,TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)]
                corners = [int(round(x)) for x in corners]
                newImage = image.crop(corners)
                newImage.save(tile_key)
                tile_keys.append(tile_key)
        image = image.resize((int(math.ceil(image.size[0]/2.)),
                              int(math.ceil(image.size[1]/2.))),
                             Image.ANTIALIAS)


def generateWarpedQuadTree(image, transformDict, basePath):
    transform = makeTransform(transformDict)
    corners = [[0,0],[image.size[0],0],[0,image.size[1]],list(image.size)]
    mercatorCorners = [transform.forward(corner)
                       for corner in corners]

    if 1:
        # debug getProjectiveInverse
        print >> sys.stderr, 'mercatorCorners:', mercatorCorners
        corners2 = [transform.reverse(corner)
                    for corner in mercatorCorners]
        print >> sys.stderr, 'zip:', zip(corners, corners2)
        for i, pair in enumerate(zip(corners, corners2)):
            c1, c2 = pair
            print >> sys.stderr, i, numpy.array(c1) - numpy.array(c2)

    bounds = Bounds()
    for corner in mercatorCorners:
        bounds.extend(corner)
    baseMask = Image.new('L', image.size, 255)

    maxZoom = calculateMaxZoom(bounds, image)
    print >> sys.stderr, 'warping...'
    totalTiles = 0
    startTime = time.time()
    for zoom in xrange(int(maxZoom), -1, -1):
        bounds = Bounds()
        for corner in mercatorCorners:
            tileCoords = tileIndex(zoom, corner)
            bounds.extend(tileCoords)
        xmin, ymin = (bounds.bounds[0], bounds.bounds[1])
        xmax, ymax = (bounds.bounds[2], bounds.bounds[3])
        maxNumTiles = (xmax - xmin + 1) * (ymax - ymin + 1)
        totalTiles += maxNumTiles
        sys.stderr.write('zoom %d: generating %d tiles' % (zoom, maxNumTiles))
        doubleSize = (int(TILE_SIZE * 2),) * 2
        for nx in xrange(int(xmin), int(xmax) + 1):
            for ny in xrange(int(ymin), int(ymax) + 1):
                sys.stderr.write('.')
                corners = tileExtent(zoom, nx, ny)

                if isinstance(transform, ProjectiveTransform):
                    # projective -- do the whole tile in one go
                    sourceCorners = [[int(round(x))
                                     for x in transform.reverse(corner)]
                                    for corner in corners]
                    transformArgs = (doubleSize,
                                     Image.QUAD,
                                     flatten(sourceCorners),
                                     Image.BICUBIC)

                    if 0:
                        print >> sys.stderr, 'corners:', corners
                        print >> sys.stderr, 'transformArgs:', transformArgs

                else:
                    # quadratic -- do the tile as a mesh of projective patches
                    if BENCHMARK_WARP_STEPS:
                        transformStart = time.time()
                    tileOrigin = corners[0]
                    doublePatchSize = PATCH_SIZE * 2
                    meshPatches = []

                    patchTable = {}
                    for ix in xrange(PATCHES_PER_TILE+1):
                        for iy in xrange(PATCHES_PER_TILE+1):
                            targetPatchOrigin = tileIndexToPixels(nx * PATCHES_PER_TILE + ix,
                                                                  ny * PATCHES_PER_TILE + iy)
                            mercatorPatchOrigin = pixelsToMeters(targetPatchOrigin[0],
                                                                 targetPatchOrigin[1],
                                                                 zoom + PATCH_ZOOM_OFFSET)
                            sourcePatchOrigin = [int(round(x))
                                                 for x in transform.reverse(mercatorPatchOrigin)]
                            patchTable[(ix, iy)] = sourcePatchOrigin
                    if BENCHMARK_WARP_STEPS:
                        print
                        print 'transformTime:', time.time() - transformStart

                    if BENCHMARK_WARP_STEPS:
                        meshStart = time.time()
                    for ix in xrange(PATCHES_PER_TILE):
                        for iy in xrange(PATCHES_PER_TILE):
                            corners = ((ix, iy),
                                       (ix, iy + 1),
                                       (ix + 1, iy + 1),
                                       (ix + 1, iy))
                            sourcePatchCorners = [patchTable[corner]
                                                  for corner in corners]
                            xoff = ix * doublePatchSize
                            yoff = iy * doublePatchSize
                            targetBox = (xoff,
                                         yoff,
                                         xoff + doublePatchSize,
                                         yoff + doublePatchSize)
                            meshPatches.append([targetBox, flatten(sourcePatchCorners)])

                            if 0:
                                print >> sys.stderr, 'patchCorners:', patchCorners
                                print >> sys.stderr, 'sourceCorners:', sourceCorners
                                print >> sys.stderr, 'targetBox:', targetBox

                    transformArgs = (doubleSize,
                                     Image.MESH,
                                     meshPatches,
                                     Image.BICUBIC)

                    if 0:
                        print >> sys.stderr, 'meshPatches:'
                        print >> sys.stderr, json.dumps(meshPatches, indent=4)
                    if BENCHMARK_WARP_STEPS:
                        print 'meshTime:', time.time() - meshStart

                if BENCHMARK_WARP_STEPS:
                    warpDataStart = time.time()
                tileData = image.transform(*transformArgs)
                if BENCHMARK_WARP_STEPS:
                    print 'warpDataTime:', time.time() - warpDataStart

                if BENCHMARK_WARP_STEPS:
                    warpMaskStart = time.time()
                tileMask = baseMask.transform(*transformArgs)
                if BENCHMARK_WARP_STEPS:
                    print 'warpMaskTime:', time.time() - warpMaskStart

                if BENCHMARK_WARP_STEPS:
                    resizeStart = time.time()
                tileData.putalpha(tileMask)
                tileData = tileData.resize((int(TILE_SIZE),) * 2, Image.ANTIALIAS)
                if not os.path.exists(basePath+'/%s/%s/' % (zoom,nx)):
                    os.makedirs(basePath+'/%s/%s' % (zoom,nx))
                if BENCHMARK_WARP_STEPS:
                    print 'resizeTime:', time.time() - resizeStart

                if BENCHMARK_WARP_STEPS:
                    saveStart = time.time()
                tileData.save(basePath+'/%s/%s/%s.png' % (zoom,nx,ny))
                if BENCHMARK_WARP_STEPS:
                    print 'saveTime:', time.time() - saveStart

                #if min(sourceCorners[0], sourceCorners[2], sourceCorners[4], sourceCorners[6], 0) < 0 or\
                #        max(sourceCorners[0], sourceCorners[2], sourceCorners[4], sourceCorners[6], image.size[0]) > image.size[0] or\
                #        min(sourceCorners[1], sourceCorners[3], sourceCorners[5], sourceCorners[7], 0) < 0 or\
                #        max(sourceCorners[1], sourceCorners[3], sourceCorners[5], sourceCorners[7], image.size[1]) > image.size[1]:
                #    tileData.save(basePath+'/%s/%s/%s.png' % (zoom,nx,ny))
                #else:
                #    tileData.save(basePath+'/%s/%s/%s.png' % (zoom,nx,ny))
        sys.stderr.write('\n')
    elapsedTime = time.time() - startTime
    print >> sys.stderr, ('warping complete: %d tiles, elapsed time %.1f seconds = %d ms/tile'
                          % (totalTiles, elapsedTime, int(1000 * elapsedTime / totalTiles)))

def resolution(zoom):
    return INITIAL_RESOLUTION / (2 ** zoom)

def latLonTometers(lat, lng):
    mx = lng * ORIGIN_SHIFT / 180
    my = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180)
    my = my * ORIGIN_SHIFT / 180
    return mx, my

def metersToLatLon(x, y):
    lng = x * 180 / originShift
    lat = y * 180 / originShift
    lat = ((math.atan(2 ** (y * (math.pi / 180))) * 360) / math.pi) - 90
    return lat, lng

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
