# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import json
import os

import PIL.Image

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotFound
from django.http import HttpResponseNotAllowed
from django.template import RequestContext
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.urlresolvers import reverse
from django.views.decorators.cache import cache_page
from django.core.files.base import ContentFile    

from geocamTiePoint import models, forms, settings
from geocamTiePoint.models import Overlay, QuadTree
from geocamTiePoint import quadTree
from geocamTiePoint import anypdf as pdf

TRANSPARENT_PNG_BINARY = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\x00\rIDAT\x08\xd7c````\x00\x00\x00\x05\x00\x01^\xf3*:\x00\x00\x00\x00IEND\xaeB`\x82'


def transparentPngResponse():
    return HttpResponse(TRANSPARENT_PNG_BINARY, content_type='image/png')


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)


def overlayIndex(request):
    if request.method == 'GET':
        overlays = models.Overlay.objects.all()
        return render_to_response('geocamTiePoint/overlay-index.html',
                                  {'overlays': overlays},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])


def overlayDelete(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-delete.html',
                                  {'overlay': overlay},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.delete()
        return HttpResponseRedirect(reverse('geocamTiePoint_overlayIndex'))


def overlayNew(request):
    if request.method == 'POST':
        form = forms.NewImageDataForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save new empty overlay so we can refer to it
            overlay = models.Overlay(author=request.user)
            overlay.save()

            # save imageData
            imageRef = form.cleaned_data['image']
            imageData = models.ImageData(contentType=imageRef.content_type,
                                         overlay=overlay)
            if imageRef.content_type == 'application/pdf':
                pngData = pdf.convertPdf(imageRef.file.read())
                imageData.image.save('dummy.png', ContentFile(pngData), save=False)
                imageData.contentType = 'image/png'
            else:
                imageData.image = imageRef
                imageData.contentType = imageRef.content_type
            imageData.save()

            # fill in overlay info
            overlay.name = imageRef.name
            overlay.imageData = imageData
            image = PIL.Image.open(imageData.image.file)
            preData = {}
            preData['points'] = []
            preData['url'] = reverse('geocamTiePoint_overlayIdJson', args=[overlay.key])
            preData['imageSize'] = image.size
            preData['key'] = overlay.key
            overlay.data = dumps(preData)
            overlay.save()

            # generate initial quad tree
            qt = overlay.generateUnalignedQuadTree()

            return render_to_response('geocamTiePoint/new-overlay-result.html',
                                      {'status': 'success',
                                       'id': overlay.key},
                                      context_instance=RequestContext(request))
    elif request.method == 'GET':
        form = forms.NewImageDataForm()
    else:
        return HttpResponseNotAllowed(('POST', 'GET'))

    return render_to_response('geocamTiePoint/new-overlay.html',
                              {'form': form},
                              context_instance=RequestContext(request))


def overlayId(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-view.html',
                                  {'overlay': overlay,
                                   'DATA_URL': settings.DATA_URL},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


def overlayIdPreview(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/overlay-preview.html',
                                  {'overlay': overlay,
                                   'DATA_URL': settings.DATA_URL},
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
            "contentType": overlay.imageData.contentType
            }
        return HttpResponse(dumps(data), content_type='application/json')
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        if 'data' in request.POST:
            overlay.data = request.POST['data']
        if 'name' in request.POST:
            overlay.name = request.POST['name']
        if 'contentType' in request.POST:
            overlay.imageData.contentType = request.POST['contentType']
        overlay.save()
        data = {
            "data": json.loads(overlay.data),
            "name": overlay.name,
            "contentType": overlay.imageData.contentType
            }
        return HttpResponse(dumps(data), content_type='application/json')
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])


@csrf_exempt
def overlayIdWarp(request, key):
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/warp-form.html', {},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.generateAlignedQuadTree()
        return HttpResponse("{}", content_type='application/json')
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])


def overlayIdImageFileName(request, key, fileName):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        fobject = overlay.imageData.image
        fobject.open()
        response = HttpResponse(fobject.read(), content_type=overlay.contentType)
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
    except quadTree.ZoomTooBig:
        return transparentPngResponse()
    except quadTree.OutOfBounds:
        return transparentPngResponse()


def dummyView(*args, **kwargs):
    return HttpResponseNotFound()
