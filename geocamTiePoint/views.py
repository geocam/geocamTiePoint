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
from django.http import HttpResponse, HttpResponseRedirect
from django.http import HttpResponseForbidden, Http404
from django.http import HttpResponseNotAllowed, HttpResponseBadRequest
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.urlresolvers import reverse

try:
    from scipy.optimize import leastsq
except ImportError:
    pass  # only needed for quadratic model with many tie points

from PIL import Image

from geocamTiePoint import models, forms, settings
from geocamTiePoint.models import Overlay



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
            image = Image.open(models.dataStorage.path(overlay.image))
            basePath = models.dataStorage.path('geocamTiePoint/tiles/'+str(overlay.key))
            preData['points'] = []
            preData['url'] = reverse('geocamTiePoint_overlayIdJson', args=[overlay.key])
            preData['tilesUrl'] = settings.DATA_URL+'geocamTiePoint/tiles/'+str(overlay.key)
            preData['imageSize'] = (overlay.image.width, overlay.image.height)
            preData['key'] = overlay.key
            overlay.data = json.dumps(preData)
            overlay.save()
            overlay.generateQuadTree() # this should be done out-of-band, ideally.
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
        overlay.deleteRegisteredTiles()
        data = json.loads(overlay.data)
        transformType = data['transform']['type']
        transformMatrix = data['transform']['matrix']
        basePath = models.dataStorage.path('geocamTiePoint/registeredTiles/'+str(overlay.key))
        generateWarpedQuadTree(Image.open(overlay.image.path), data['transform'], basePath)
        tarFilePath = models.dataStorage.path('geocamTiePoint/tileArchives/')
        if not os.path.exists(tarFilePath):
            os.makedirs(tarFilePath)
        oldPath = os.getcwd()
        os.chdir(basePath)
        tarFile = tarfile.open(tarFilePath+'/'+str(overlay.key)+'.tar.gz', 'w:gz')
        for name in os.listdir(os.getcwd()):
            tarFile.add(name)
        os.chdir(oldPath)
        tarFile.close()
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

