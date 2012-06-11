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

try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

from PIL import Image

from geocamTiePoint import models, forms, settings

def overlayIndex(request):
    if request.method == 'GET':
        overlays = models.Overlay.objects.all()
        return render_to_response('overlay-index.html', {'overlays':overlays})
    else:
        return HttpResponseNotAllowed(['GET','POST'])

def overlayDelete(request, key):
    if request.method == 'GET':
        try:
            overlay = models.Overlay.objects.get(key=key)
        except models.Overlay.DoesNotExist:
            raise Http404()
        return render_to_response('overlay-delete.html', {'overlay':overlay,
                                                          'index_url':'/'+settings.TIEPOINT_URL+'/'})
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
        return render_to_response('new-overlay.html', RequestContext(request, {'form':form}))
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
        overlay.data = json.dumps(preData)
        overlay.save()
        return render_to_response('new-overlay-result.html', 
                                  {'status':'success',
                                   'id':overlay.key})
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
            return render_to_response('map-simple.html',
                                      {'overlay':overlay})
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
        return render_to_response('warp-form.html',{})
    elif request.method == 'POST':
        # "eventually"
        return HttpResponse()
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
    if image.size[0] > image.size[1]:
        maxZoom = int(math.ceil(math.log(image.size[0]/256.,2)))
    else:
        maxZoom = int(math.ceil(math.log(image.size[1]/256.,2)))

    for i in xrange(maxZoom, -1, -1):
        nx = int(math.ceil(image.size[0]/256.))
        ny = int(math.ceil(image.size[1]/256.))
        for ix in xrange(nx):
            for iy in xrange(ny):
                if not os.path.exists(basePath+'/%s/%s/' % (i,ix)):
                    os.makedirs(basePath+'/%s/%s' % (i,ix))
                newImage = image.crop([256*ix,256*iy,256*(ix+1),256*(iy+1)])
                newImage.save(basePath+'/%s/%s/%s.jpg' % (i,ix,iy))
        image = image.resize((int(math.ceil(image.size[0]/2.)),
                              int(math.ceil(image.size[1]/2.))))
