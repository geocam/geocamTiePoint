# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Instance of X has no 'Y' member (false alarm for abstract classes)
# pylint: disable=E1101

import json
import os
import math
import sys
import time
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO
import zipfile
import tarfile

from PIL import Image
import numpy
import numpy.linalg

from django.core.cache import cache

from geocamTiePoint import transform

TILE_SIZE = 256.
PATCH_SIZE = 32
PATCHES_PER_TILE = int(TILE_SIZE / PATCH_SIZE)
PATCH_ZOOM_OFFSET = math.log(PATCHES_PER_TILE, 2)
INITIAL_RESOLUTION = 2 * math.pi * 6378137 / TILE_SIZE
ORIGIN_SHIFT = 2 * math.pi * (6378137 / 2.)
ZOOM_OFFSET = 3
BENCHMARK_WARP_STEPS = False
BLACK = (0, 0, 0)
GRAY = (192, 192, 192)


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
    return int(math.ceil(decimalZoom))


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


def tileBoundsLonLat(zoom, x, y):
    corners = ((x, y),
               (x + 1, y + 1))
    pixelCorners = [tileIndexToPixels(*corner) for corner in corners]
    mercatorCorners = [pixelsToMeters(*(pixels + (zoom,))) for pixels in pixelCorners]
    nw, se = [metersToLatLon(c) for c in mercatorCorners]
    west, north = nw
    east, south = se
    return {
        'north': north,
        'south': south,
        'east': east,
        'west': west
    }


def tileIndexToPixels(x, y):
    return x * TILE_SIZE, y * TILE_SIZE


def applyProjectiveTransform(matrix, pt):
    print >> sys.stderr, pt
    u = numpy.array(list(pt) + [1], 'd')
    v0 = matrix.dot(u)
    # projective rescaling: divide by z and truncate
    v = (v0 / v0[2])[:2]
    return v.tolist()


def flatten(listOfLists):
    return [item for subList in listOfLists for item in subList]


def getImageDataPng(image):
    out = StringIO()
    image.save(out, format='png')
    return (out.getvalue(), 'image/png')


def getTileCacheKey(quadTreeId, zoom, x, y):
    return ('geocamTiePoint.tile.%s.%s.%s.%s'
            % (quadTreeId, zoom, x, y))


def setBackgroundColor(image, backgroundColor):
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    background = Image.new('RGB', image.size, backgroundColor)
    alpha = image.split()[3]
    background.paste(image, mask=alpha)
    return background


def getImageDataJpg(image):
    out = StringIO()
    image = setBackgroundColor(image, GRAY)
    image.save(out, format='jpeg')
    return (out.getvalue(), 'image/jpeg')


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


def imageMapBounds(imageSize, tform):
    w, h = imageSize
    imageCorners = cornerPoints([0, 0, w, h])
    mercatorCorners = [tform.forward(c) for c in imageCorners]
    latLonCorners = [metersToLatLon(c) for c in mercatorCorners]
    bounds = Bounds(latLonCorners)
    return {'west': bounds.xmin,
            'south': bounds.ymin,
            'east': bounds.xmax,
            'north': bounds.ymax}


def intMap(floatList):
    if floatList is None:
        return None
    else:
        return [int(round(x)) for x in floatList]


def contentTypeToExtension(contentType):
    if contentType == 'image/png':
        return '.png'
    elif contentType == 'image/jpeg':
        return '.jpg'
    else:
        raise ValueError('unknown content type')


def getDirTarInfo(name, mode=0755):
    result = tarfile.TarInfo(name)
    result.mtime = time.time()
    result.mode = mode
    result.type = tarfile.DIRTYPE
    return result


def getFileTarInfo(name, rawData, mode=0644):
    result = tarfile.TarInfo(name)
    result.size = len(rawData)
    result.mtime = time.time()
    result.mode = mode
    result.type = tarfile.REGTYPE
    return result


class TarWriter(object):
    """
    A writer class where writeX() methods add file entries to an
    in-memory tar.gz file.  The paths of all entries in the tarball are
    prefixed with dirName. Once all entries have been added, the raw
    tarball contents can be extracted using the getData() method and
    written to a file or blob storage.
    """

    def __init__(self, dirName):
        self.dirName = dirName
        self.out = StringIO()
        self.tar = tarfile.open(fileobj=self.out, mode='w:gz')
        self.tar.addfile(getDirTarInfo(self.dirName))
        self.closed = False

    def writeData(self, path, data):
        assert not self.closed
        if isinstance(data, unicode):
            data = data.encode('utf-8')
        tinfo = getFileTarInfo(os.path.join(self.dirName, path),
                               data)
        self.tar.addfile(tinfo, fileobj=StringIO(data))

    def getData(self):
        if not self.closed:
            self.tar.close()
            self.closed = True
        return self.out.getvalue()


class ZipWriter(object):
    """
    A writer class where writeX() methods add file entries to an
    in-memory zip file.  The paths of all entries in the zip file are
    prefixed with dirName. Once all entries have been added, the raw zip
    contents can be extracted using the getData() method and written to
    a file or blob storage.
    """

    def __init__(self, dirName):
        self.dirName = dirName
        self.out = StringIO()
        self.zip = zipfile.ZipFile(self.out, 'w')
        self.closed = False

    def writeData(self, path, data):
        assert not self.closed
        self.zip.writestr(os.path.join(self.dirName, path),
                          data)

    def getData(self):
        if not self.closed:
            self.zip.close()
            self.closed = True
        return self.out.getvalue()


class FileWriter(object):
    """
    A writer class where writeX() methods write files to disk under the specified
    basePath.
    """

    def __init__(self, basePath):
        self.basePath = basePath

    def makeParentDirIfNeeded(self, fullPath):
        d = os.path.dirname(fullPath)
        if not os.path.exists(d):
            os.makedirs(d)

    def writeData(self, path, data):
        fullPath = os.path.join(self.basePath, path)
        self.makeParentDirIfNeeded(fullPath)
        open(fullPath, 'w').write(data)


class AbstractQuadTreeGenerator(object):
    def getTileData(self, zoom, x, y):
        raise NotImplementedError('implement in derived classes')

    def getTileDataWithCache(self, zoom, x, y):
        key = getTileCacheKey(self.quadTreeId, zoom, x, y)
        data = cache.get(key)
        if data is None:
            data = self.getTileData(zoom, x, y)
            cache.set(key, data)
        return data

    def writeTile(self, writer, slug, zoom, x, y):
        bits, contentType = self.getTileDataWithCache(zoom, x, y)

        if BENCHMARK_WARP_STEPS:
            saveStart = time.time()
        ext = contentTypeToExtension(contentType)
        writer.writeData('%s/%s/%s/%s%s' % (slug, zoom, x, y, ext),
                         bits)
        if BENCHMARK_WARP_STEPS:
            print 'saveTime:', time.time() - saveStart


class SimpleQuadTreeGenerator(AbstractQuadTreeGenerator):
    def __init__(self, quadTreeId, image):
        self.quadTreeId = quadTreeId
        self.imageSize = image.size
        w, h = self.imageSize
        self.coords = ((0, 0),
                       (w, 0),
                       (0, h),
                       (w, h))

        if self.imageSize[0] > self.imageSize[1]:
            self.maxZoom = int(math.ceil(math.log(self.imageSize[0] / TILE_SIZE, 2)))
        else:
            self.maxZoom = int(math.ceil(math.log(self.imageSize[1] / TILE_SIZE, 2)))

        self.zoomedImage = {}
        self.zoomedImage[self.maxZoom] = image

    def getZoomedImage(self, zoom):
        result = self.zoomedImage.get(zoom, None)
        if result is None:
            image = self.getZoomedImage(zoom + 1)
            result = image.resize((int(math.ceil(image.size[0] / 2.)),
                                   int(math.ceil(image.size[1] / 2.))),
                                  Image.ANTIALIAS)
            self.zoomedImage[zoom] = result
        return result

    def writeQuadTree(self, writer, slug):
        for zoom in xrange(self.maxZoom, -1, -1):
            nx = int(math.ceil(self.imageSize[0] / TILE_SIZE))
            ny = int(math.ceil(self.imageSize[1] / TILE_SIZE))
            for x in xrange(nx):
                for y in xrange(ny):
                    zoom0 = zoom + ZOOM_OFFSET
                    try:
                        self.writeTile(writer, slug, zoom0, x, y)
                    except OutOfBounds:
                        # no surprise if some tiles are empty around the edges
                        pass

    def getTileData(self, zoom0, x, y):
        return getImageDataJpg(self.generateTile(zoom0, x, y))

    def generateTile(self, zoom0, x, y):
        zoom = zoom0 - ZOOM_OFFSET

        tileBounds = [TILE_SIZE * x,
                      TILE_SIZE * y,
                      TILE_SIZE * (x + 1),
                      TILE_SIZE * (y + 1)]
        tileBounds = [int(round(c)) for c in tileBounds]

        if zoom > self.maxZoom:
            # this tile is at greater resolution than the original
            # image. use transform() to upsample.
            image = self.getZoomedImage(self.maxZoom)
            k = zoom - self.maxZoom
            sourceTileBounds = [v / 2 ** k for v in tileBounds]
            if allPointsOutsideCorners(cornerPoints(sourceTileBounds), getImageCorners(image)):
                raise OutOfBounds("tile at zoom=%d, x=%d, y=%d is out of the image bounds"
                                  % (zoom0, x, y))
            return image.transform((int(TILE_SIZE), int(TILE_SIZE)),
                                   Image.EXTENT,
                                   sourceTileBounds,
                                   Image.BICUBIC)
        else:
            # this tile is at lower resolution than the original
            # image. use crop() to extract it from one of the cached
            # downsampled versions of the image.
            image = self.getZoomedImage(zoom)
            if allPointsOutsideCorners(cornerPoints(tileBounds), getImageCorners(image)):
                raise OutOfBounds("tile at zoom=%d, x=%d, y=%d is out of the image bounds"
                                  % (zoom0, x, y))
            return image.crop(tileBounds)


def pairsWithWrap(lst):
    prev = None
    item = None
    for item in lst:
        if prev is None:
            first = item
        else:
            yield prev, item
        prev = item
    if first is not None:
        yield item, first


def interp(d, pt1, pt2):
    return (1.0 - d) * pt1 + d * pt2


def fillEdgesVec(corners, numSteps):
    result = []
    for c1, c2 in pairsWithWrap(corners):
        for d in numpy.linspace(0, 1, numSteps):
            result.append(interp(d, c1, c2))
    return result


def fillEdges(corners, numSteps):
    resultVec = fillEdgesVec([numpy.array(c)
                              for c in corners],
                             numSteps)
    return [v.tolist() for v in resultVec]


class WarpedQuadTreeGenerator(AbstractQuadTreeGenerator):
    def __init__(self, quadTreeId, image, transformDict):
        self.quadTreeId = quadTreeId
        self.image = image
        self.transform = transform.makeTransform(transformDict)

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

        imageEdgePoints = fillEdges(corners, 5)
        self.mercatorEdgePoints = [self.transform.forward(edgePoint)
                                   for edgePoint in imageEdgePoints]

        bounds = Bounds()
        for edgePoint in self.mercatorEdgePoints:
            bounds.extend(edgePoint)

        self.maxZoom = calculateMaxZoom(bounds, self.image)
        self.tileBounds = {}

    def getTileBounds(self, zoom):
        result = self.tileBounds.get(zoom)
        if result is None:
            result = Bounds()
            for edgePoint in self.mercatorEdgePoints:
                tileCoords = tileIndex(zoom, edgePoint)
                result.extend(tileCoords)
            self.tileBounds[zoom] = result
        return result

    def writeQuadTree(self, writer, slug):
        print >> sys.stderr, 'warping...'
        totalTiles = 0
        startTime = time.time()

        totalTiles = 0
        for zoom in xrange(int(self.maxZoom), -1, -1):
            xmin, ymin, xmax, ymax = self.getTileBounds(zoom).bounds
            numTilesAtZoom = (xmax - xmin + 1) * (ymax - ymin + 1)
            totalTiles += numTilesAtZoom
        sys.stderr.write('%d total tiles\n' % totalTiles)

        tilesSoFar = 0
        for zoom in xrange(int(self.maxZoom), -1, -1):
            xmin, ymin, xmax, ymax = self.getTileBounds(zoom).bounds
            maxNumTiles = (xmax - xmin + 1) * (ymax - ymin + 1)
            sys.stderr.write('zoom %d (%d tiles)' % (zoom, maxNumTiles))
            for x in xrange(int(xmin), int(xmax) + 1):
                for y in xrange(int(ymin), int(ymax) + 1):
                    try:
                        self.writeTile(writer, slug, zoom, x, y)
                    except OutOfBounds:
                        # no surprise if some tiles are empty around the edges
                        pass
                    tilesSoFar += 1
            sys.stderr.write('[completed tiles: %d / %d]\n' % (tilesSoFar, totalTiles))

        elapsedTime = time.time() - startTime
        print >> sys.stderr, ('warping complete: %d tiles, elapsed time %.1f seconds = %d ms/tile'
                              % (totalTiles, elapsedTime, int(1000 * elapsedTime / totalTiles)))

    def getTileData(self, zoom, x, y):
        return getImageDataPng(self.generateTile(zoom, x, y))

    def generateTile(self, zoom, x, y):
        xmin, ymin, xmax, ymax = self.getTileBounds(zoom).bounds
        if (not ((xmin <= x <= xmax)
                 and (ymin <= y <= ymax))):
            raise OutOfBounds("tile at zoom=%d, x=%d, y=%d is out of the image bounds"
                              % (zoom, x, y))

        sys.stderr.write('.')

        if isinstance(self.transform,
                      (transform.LinearTransform,
                       transform.ProjectiveTransform)):
            transformArgs = self.getPilTransformArgsProjective(zoom, x, y)
        else:
            transformArgs = self.getPilTransformArgsGeneral(zoom, x, y)

        if BENCHMARK_WARP_STEPS:
            warpDataStart = time.time()
        tileImage = self.image.transform(*transformArgs)
        if BENCHMARK_WARP_STEPS:
            print 'warpDataTime:', time.time() - warpDataStart

        if BENCHMARK_WARP_STEPS:
            resizeStart = time.time()
        tileImage = tileImage.resize((int(TILE_SIZE),) * 2, Image.ANTIALIAS)
        if BENCHMARK_WARP_STEPS:
            print 'resizeTime:', time.time() - resizeStart

        return tileImage

    def getPilTransformArgsProjective(self, zoom, x, y):
        corners = tileExtent(zoom, x, y)
        sourceCorners = [intMap(self.transform.reverse(corner))
                         for corner in corners]

        return ((int(TILE_SIZE * 2),) * 2,
                Image.QUAD,
                flatten(sourceCorners),
                Image.BICUBIC)

    def getPilTransformArgsGeneral(self, zoom, x, y):
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
                sourcePatchOrigin = intMap(self.transform.reverse(mercatorPatchOrigin))
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

                # reject the patch if any corner is out of bounds
                if any([c is None
                        for c in sourcePatchCorners]):
                    continue

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
