# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseRedirect
from django.http import HttpResponseForbidden, Http404
from django.http import HttpResponseNotAllowed, HttpResponseBadRequest
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _

import json, base64, os.path, os, math
import numpy, numpy.linalg

try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

from PIL import Image

from geocamTiePoint import models, forms, settings

TILE_SIZE = 256.
INITIAL_RESOLUTION = 2 * math.pi * 6378137 / TILE_SIZE
ORIGIN_SHIFT = 2 * math.pi * (6378137 / 2.)
ZOOM_OFFSET = 3

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
        print point
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
        print "bounds are now"
        print self.bounds

def overlayIndex(request):
    if request.method == 'GET':
        overlays = models.Overlay.objects.all()
        return render_to_response('overlay-index.html', {'overlays':overlays},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET','POST'])

def overlayDelete(request, key):
    if request.method == 'GET':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        return render_to_response('overlay-delete.html', {'overlay':overlay,
                                                          'index_url':'/'+settings.TIEPOINT_URL+'/'},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        overlay.delete()
        return HttpResponseRedirect("/"+settings.TIEPOINT_URL+'/')

def overlayNew(request):
    if request.method == 'GET':
        form = forms.NewOverlayForm()
        return render_to_response('new-overlay.html', {'form':form},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        form = forms.NewOverlayForm(request.POST, request.FILES)
        if not form.is_valid():
            return HttpResponseBadRequest()
        image = form.cleaned_data['image']
        preData = {}
        overlay = models.Overlay(image=image, imageType=image.content_type,
                                 name=os.path.split(image.name)[-1],
                                 data=json.dumps(preData))
        overlay.save()
        image = Image.open(models.dataStorage.path(overlay.image))
        basePath = models.dataStorage.path('geocamTiePoint/tiles/'+str(overlay.key))
        generateQuadTree(image,basePath)
        preData['points'] = []
        preData['url'] = '/'+settings.TIEPOINT_URL+'/'+str(overlay.key)+'.json'
        preData['tilesUrl'] = settings.DATA_URL+'geocamTiePoint/tiles/'+str(overlay.key)
        preData['imageSize'] = (overlay.image.width, overlay.image.height)
        preData['key'] = overlay.key
        overlay.data = json.dumps(preData)
        overlay.save()
        return render_to_response('new-overlay-result.html', {'status':'success',
                                                              'id':overlay.key},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET','POST'])

def overlayId(request, key):
    if request.method == 'GET':
        # this line maybe should be try/catched to check for non-existing overlays
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        else:
            return render_to_response('map-simple.html', {'overlay':overlay},
                                      context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])

def overlayIdJson(request, key):
    if request.method == 'GET':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        return HttpResponse(overlay.data)
    elif request.method == 'POST':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        overlay.data = request.POST['data']
        overlay.name = request.POST['name']
        overlay.imageType = request.POST['imageType']
        overlay.save()
        return HttpResponse("")
    else:
        return HttpResponseNotAllowed(['GET','POST'])

def overlayIdWarp(request, key):
    if request.method == 'GET':
        return render_to_response('warp-form.html',{},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        data = json.loads(overlay.data)
        transformType = data['transform']['type']
        transformMatrix = data['transform']['matrix']
        basePath = models.dataStorage.path('geocamTiePoint/registeredTiles/'+str(overlay.key))
        generateWarpedQuadTree(Image.open(overlay.image.path), transformType,
                               transformMatrix, basePath)
    else:
        return HttpResponseNotAllowed(['GET','POST'])

def overlayIdImageFileName(request, key, fileName):
    if request.method == 'GET':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        fobject = overlay.image; fobject.open()
        response = HttpResponse(fobject.read(), content_type=overlay.imageType)
        return response
    else:
        return HttpResponseNotAllowed(['GET'])

def splitArray(array, by):
    by = int(by)
    assert(by > 1)
    newArray = []
    for i in range(0, int(float(len(array))/by)+1, by):
        newArray.append(array[i:i+by])
    return newArray

def generateQuadTree(image, basePath):
    coords = ((0,0),(image.size[0],0),(0,image.size[1]),image.size)
    makeQuadTree(image, coords, basePath)

def makeQuadTree(image, coords, basePath):
    if image.size[0] > image.size[1]:
        maxZoom = int(math.ceil(math.log(image.size[0]/TILE_SIZE,2)))
    else:
        maxZoom = int(math.ceil(math.log(image.size[1]/TILE_SIZE,2)))
    for i in xrange(maxZoom, -1, -1):
        nx = int(math.ceil(image.size[0]/TILE_SIZE))
        ny = int(math.ceil(image.size[1]/TILE_SIZE))
        for ix in xrange(nx):
            for iy in xrange(ny):
                if testOutsideImage((TILE_SIZE*ix,TILE_SIZE*iy),coords) or\
                        testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*iy),coords) or\
                        testOutsideImage((TILE_SIZE*ix,TILE_SIZE*(iy+1)),coords) or\
                        testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)),coords):
                    continue
                if not os.path.exists(basePath+'/%s/%s/' % (i+ZOOM_OFFSET,ix)):
                    os.makedirs(basePath+'/%s/%s' % (i+ZOOM_OFFSET,ix))
                corners = [TILE_SIZE*ix,TILE_SIZE*iy,TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)]
                corners = [int(round(x)) for x in corners]
                newImage = image.crop(corners)
                newImage.save(basePath+'/%s/%s/%s.jpg' % (i+ZOOM_OFFSET,ix,iy))
        image = image.resize((int(math.ceil(image.size[0]/2.)),
                              int(math.ceil(image.size[1]/2.))),
                             Image.ANTIALIAS)
                    

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
    print "pixels"
    print coords
    index = [int(math.floor(coord / (TILE_SIZE))) for coord in coords]
    print "index"
    print index
    return index

def tileExtent(zoom, x, y):
    corners = ((x,y),(x,y+1),(x+1,y+1),(x+1,y))
    pixelCorners = [tileIndexToPixels(*corner) for corner in corners]
    mercatorCorners = [pixelsToMeters(*(pixels + (zoom,))) for pixels in pixelCorners]
    return mercatorCorners

def tileIndexToPixels(x,y):
    return x*TILE_SIZE, y*TILE_SIZE

def generateWarpedQuadTree(image, method, matrix, basePath):
    print [matrix[:3],matrix[3:6],matrix[6:]]
    matrix = numpy.matrix([matrix[:3],matrix[3:6],matrix[6:]])
    matrixInverse = numpy.linalg.inv(matrix)
    corners = [[0,0],[image.size[0],0],[0,image.size[1]],image.size]
    mercatorCorners = []
    for corner in corners:
        corner += (1,)
        corner = numpy.matrix(corner).reshape(3,1)
        output = (matrix * corner).reshape(1,3)
        output = output.tolist()[0][:2]
        mercatorCorners.append(output)
    bounds = Bounds()
    for corner in mercatorCorners:
        bounds.extend(corner)
    print "bounds"
    print bounds.bounds

    maxZoom = calculateMaxZoom(bounds, image)
    for zoom in xrange(int(maxZoom), -1, -1):
        bounds = Bounds()
        for corner in mercatorCorners:
            tileCoords = tileIndex(zoom, corner)
            bounds.extend(tileCoords)
        xmin, ymin = (bounds.bounds[0], bounds.bounds[1])
        xmax, ymax = (bounds.bounds[2], bounds.bounds[3])
        print "bounds"
        print xmin, ymin
        print xmax, ymax
        for nx in xrange(int(xmin), int(xmax) + 1):
            print "x: %s" % nx
            for ny in xrange(int(ymin), int(ymax) + 1):
                corners = tileExtent(zoom, nx, ny)
                imageCorners = []
                for corner in corners:
                    corner += (1,)
                    corner = numpy.matrix(corner).reshape(3,1)
                    output = (matrixInverse * corner).reshape(1,3)
                    print "in pixels"
                    output = output.tolist()[0][:2]
                    output = [int(round(x)) for x in output]
                    print output
                    imageCorners.extend(output)
                print imageCorners
                print "size of y side"
                print imageCorners[3]-imageCorners[1]
                print "size of x side"
                print imageCorners[6]-imageCorners[0]
                tileData = image.transform((int(TILE_SIZE),)*2, Image.QUAD,
                                           imageCorners, Image.BICUBIC)
                if not os.path.exists(basePath+'/%s/%s/' % (zoom,nx)):
                    os.makedirs(basePath+'/%s/%s' % (zoom,nx))
                tileData.save(basePath+'/%s/%s/%s.jpg' % (zoom,nx,ny))

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
    return mx, my

def metersToPixels(x, y, zoom):
    res = resolution(zoom)
    px = (x + ORIGIN_SHIFT) / res
    py = (-y + ORIGIN_SHIFT) / res
    return px, py
