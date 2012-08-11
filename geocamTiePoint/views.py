# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import json
import base64
import os
import math
import sys
import time
import tarfile

import numpy
import numpy.linalg
try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotFound
from django.http import HttpResponseForbidden, Http404
from django.http import HttpResponseNotAllowed, HttpResponseBadRequest
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.urlresolvers import reverse
from django.views.decorators.cache import cache_page

try:
    from scipy.optimize import leastsq
except ImportError:
    pass  # only needed for quadratic model with many tie points

from PIL import Image

from geocamTiePoint import models, forms, settings
from geocamTiePoint.models import Overlay, QuadTree
from geocamTiePoint import quadtree

TRANSPARENT_PNG_BINARY = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\x00\rIDAT\x08\xd7c````\x00\x00\x00\x05\x00\x01^\xf3*:\x00\x00\x00\x00IEND\xaeB`\x82'


def transparentPngResponse():
    return HttpResponse(TRANSPARENT_PNG_BINARY, mimetype='image/png')


def overlayIndex(request):
    if request.method == 'GET':
        overlays = models.Overlay.objects.all()
        return render_to_response('geocamTiePoint/overlay-index.html',
                                  {'overlays':overlays},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET','POST'])


def overlayDelete(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-delete.html',
                                  {'overlay':overlay},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.delete()
        return HttpResponseRedirect(reverse('geocamTiePoint_overlayIndex'))


def overlayNew(request):
    if request.method == 'POST':
        form = forms.NewOverlayForm(request.POST, request.FILES)
        if form.is_valid():
            image = form.cleaned_data['image']
            preData = {}
            overlay = models.Overlay(image=image,
                                     imageType=image.content_type,
                                     name=os.path.basename(image.name),
                                     data=json.dumps(preData))
            overlay.save()
            qt = overlay.generateQuadTree()
            image = Image.open(models.dataStorage.path(overlay.image))
            basePath = models.dataStorage.path('geocamTiePoint/tiles/'+str(overlay.key))
            preData['points'] = []
            preData['url'] = reverse('geocamTiePoint_overlayIdJson', args=[overlay.key])
            preData['tilesUrl'] = reverse('geocamTiePoint_tileRoot', args=[qt.id])
            preData['imageSize'] = (overlay.image.width, overlay.image.height)
            preData['key'] = overlay.key
            overlay.data = json.dumps(preData)
            overlay.save()
            return render_to_response('geocamTiePoint/new-overlay-result.html',
                                      {'status':'success',
                                       'id':overlay.key},
                                      context_instance=RequestContext(request))
    elif request.method == 'GET':
        form = forms.NewOverlayForm()
    else:
        return HttpResponseNotAllowed(('POST', 'GET'))

    return render_to_response('geocamTiePoint/new-overlay.html',
                              {'form': form},
                              context_instance=RequestContext(request))


def overlayId(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-view.html',
                                  {'overlay':overlay,
                                   'DATA_URL':settings.DATA_URL},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


def overlayIdPreview(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-preview.html',
                                  {'overlay':overlay,
                                   'DATA_URL':settings.DATA_URL},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


@csrf_exempt
def overlayIdJson(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        data = {
            "data": json.loads(overlay.data),
            "name": overlay.name,
            "imageType": overlay.imageType
            }
        return HttpResponse(json.dumps(data))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        if 'data' in request.POST:
            overlay.data = request.POST['data']
        if 'name' in request.POST:
            overlay.name = request.POST['name']
        if 'imageType' in request.POST:
            overlay.imageType = request.POST['imageType']
        overlay.save()
        data = {
            "data": json.loads(overlay.data),
            "name": overlay.name,
            "imageType": overlay.imageType
            }
        return HttpResponse(json.dumps(data))
    else:
        return HttpResponseNotAllowed(['GET','POST'])


@csrf_exempt
def overlayIdWarp(request, key):
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/warp-form.html',{},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        data = json.loads(overlay.data)
        transformType = data['transform']['type']
        transformMatrix = data['transform']['matrix']
        overlay.generateAlignedQuadTree()
        return HttpResponse("{}")
    else:
        return HttpResponseNotAllowed(['GET','POST'])


def overlayIdImageFileName(request, key, fileName):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        fobject = overlay.image; fobject.open()
        response = HttpResponse(fobject.read(), content_type=overlay.imageType)
        return response
    else:
        return HttpResponseNotAllowed(['GET'])


@cache_page(3600 * 24 * 365)
def getTile(request, quadTreeId, zoom, x, y):
    quadTreeId = int(quadTreeId)
    zoom = int(zoom)
    x = int(x)
    y = int(y)

    qt = get_object_or_404(QuadTree, id=quadTreeId)
    gen = qt.getGenerator()
    try:
        return gen.getTileResponse(zoom, x, y)
    except quadtree.ZoomTooBig:
        return transparentPngResponse()
    except quadtree.OutOfBounds:
        return transparentPngResponse()


def helloQuadTree(request, quadTreeId):
    return HttpResponse('hello')
