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

import json, base64, os.path

try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

from geocamTiePoint import models, forms, settings

def index(request):
    """ The main view """
    return HttpResponseForbidden()

def overlayNew(request):
    if request.method == 'GET':
        form = forms.NewOverlayForm()
        return render_to_response('new-overlay.html', RequestContext(request, {'form':form}))
    elif request.method == 'POST':
        form = forms.NewOverlayForm(request.POST, request.FILES)
        if form.is_valid():
            image = form.cleaned_data['image']
            preData = {}
            overlay = models.Overlay(image=image, imageType=image.content_type,
                                     name=os.path.split(image.name)[-1],
                                     data=json.dumps(preData))
            overlay.save()
            preData['points'] = []
            preData['url'] = '/'+settings.TIEPOINT_URL+'/'+str(overlay.key)+'.json'
            preData['tilesUrl'] = settings.DATA_URL+'geocamTiePoint/tiles/'+str(overlay.key)
            overlay.data = json.dumps(preData)
            overlay.save()
            return render_to_response('new-overlay-result.html', 
                                      {'status':'success',
                                       'id':overlay.key})
        else:
            return HttpResponseBadRequest()
    else:
        return HttpResponseNotAllowed()

def overlayId(request, key):
    if request.method == 'GET':
        # this line maybe should be try/catched to check for non-existing overlays
        overlay = models.Overlay.objects.get(key=key)
        return render_to_response('map-simple.html',
                                  {'overlay':overlay})
    else:
        return HttpResponseNotAllowed()

def overlayIdJson(request, key):
    if request.method == 'GET':
        overlay = models.Overlay.objects.get(key=key)
        return HttpResponse(overlay.data)
    elif request.method == 'POST':
        overlay = models.Overlay.objects.get(key=key)
        overlay.data = request.POST['data']
        overlay.name = request.POST['name']
        overlay.imageType = request.POST['imageType']
        overlay.save()
        return HttpResponse("")
    else:
        return HttpResponseNotAllowed()

def overlayIdWarp(request, key):
    if request.method == 'GET':
        return render_to_response('warp-form.html',{})
    elif request.method == 'POST':
        # "eventually"
        pass

def overlayIdImageFileName(request, key, fileName):
    if request.method == 'GET':
        overlay = models.Overlay.objects.get(key=key)
        fobject = overlay.image; fobject.open()
        response = HttpResponse(fobject.read(), content_type=overlay.imageType)
        return response
    else:
        return HttpResponseNotAllowed()

def splitArray(array, by):
    by = int(by)
    assert(by > 1)
    newArray = []
    for i in range(0, int(float(len(array))/by)+1, by):
        newArray.append(array[i:i+by])
    return newArray
