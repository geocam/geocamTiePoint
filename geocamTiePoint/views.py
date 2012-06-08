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

import json, base64

try:
    import cStringIO as StringIO
except ImportError:
    import StringIO

from geocamTiePoint import models, forms

def index(request):
    """ The main view """
    return HttpResponseForbidden()

def overlayNew(request):
    if request.method == 'GET':
        form = forms.NewOverlayForm()
        return render_to_response('new-overlay.html', {'form':form})
    elif request.method == 'POST':
        form = forms.NewOverlayForm(request.POST)
        if form.is_valid():
            image = form.cleaned_data['image']
            overlay = models.Overlay(image=image)
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
        fobject = overlay.image.open()
        data = StringIO.StringIO()
        base64.encode(fobject, data)
        response = HttpResponse(data.getvalue(), content_type="image/png")
        response['Content-Transfer-Encoding'] = 'base64'
    else:
        return HttpResponseNotAllowed()

def splitArray(array, by):
    by = int(by)
    assert(by > 1)
    newArray = []
    for i in range(0, int(float(len(array))/by)+1, by):
        newArray.append(array[i:i+by])
    return newArray
