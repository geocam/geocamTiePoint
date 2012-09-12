# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import json
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

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
from django.db import transaction

from geocamTiePoint import models, forms, settings
from geocamTiePoint.models import Overlay, QuadTree
from geocamTiePoint import quadTree
from geocamTiePoint import anypdf as pdf

TRANSPARENT_PNG_BINARY = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\x00\rIDAT\x08\xd7c````\x00\x00\x00\x05\x00\x01^\xf3*:\x00\x00\x00\x00IEND\xaeB`\x82'

PDF_MIME_TYPES = ('application/pdf',
                  'application/acrobat',
                  'application/nappdf',
                  'application/x-pdf',
                  'application/vnd.pdf',
                  'text/pdf',
                  'text/x-pdf',
                  )


def transparentPngResponse():
    return HttpResponse(TRANSPARENT_PNG_BINARY, content_type='image/png')


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)

def export_settings(export_vars=None):
    if export_vars == None:
        export_vars = (
            'GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT',
            'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION',
        )
    return dumps( dict([(k, getattr(settings, k)) for k in export_vars]) )
    


def ember(request):
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/ember.html', {},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])

def backbone(request):
    initial_overlays = Overlay.objects.order_by('pk');
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/backbone.html', 
            {
                'initial_overlays_json': dumps( list(o.jsonDict for o in initial_overlays) ) if initial_overlays else [],
                'settings': export_settings(),
            },
            context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


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
                                  {'overlay': overlay,
                                   'overlayJson': dumps(overlay.jsonDict)},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.delete()
        return HttpResponseRedirect(reverse('geocamTiePoint_overlayIndex'))


@transaction.commit_on_success
def overlayNew(request):
    if request.method == 'POST':
        form = forms.NewImageDataForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save new empty overlay so we can refer to it
            overlay = models.Overlay(author=request.user)
            overlay.save()

            # save imageData
            image = None
            imageRef = form.cleaned_data['image']
            imageData = models.ImageData(contentType=imageRef.content_type,
                                         overlay=overlay)
            if imageRef.content_type in PDF_MIME_TYPES:
                # convert PDF to raster image
                pngData = pdf.convertPdf(imageRef.file.read())
                imageData.image.save('dummy.png', ContentFile(pngData), save=False)
                imageData.contentType = 'image/png'
            else:
                image = PIL.Image.open(imageRef.file)
                if image.mode != 'RGBA':
                    # add alpha channel to image for better
                    # transparency handling later
                    image = image.convert('RGBA')
                    out = StringIO()
                    image.save(out, format='png')
                    imageData.image.save('dummy.png', ContentFile(out.getvalue()), save=False)
                    imageData.contentType = 'image/png'
                else:
                    imageData.image = imageRef
                    imageData.contentType = imageRef.content_type
            imageData.save()

            if image is None:
                image = PIL.Image.open(imageData.image.file)

            # fill in overlay info
            overlay.name = imageRef.name
            overlay.imageData = imageData
            overlay.extras.points = []
            overlay.extras.imageSize = image.size
            overlay.save()

            # generate initial quad tree
            overlay.generateUnalignedQuadTree()

            return render_to_response('geocamTiePoint/new-overlay-result.html',
                                      {'status': 'success',
                                       'id': overlay.key},
                                      context_instance=RequestContext(request))
        else:
            return render_to_response('geocamTiePoint/new-overlay.html',
                                      {'form': form},
                                      context_instance=RequestContext(request))

    elif request.method == 'GET':
        form = forms.NewImageDataForm()
        return render_to_response('geocamTiePoint/new-overlay.html',
                                  {'form': form},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(('POST', 'GET'))


def overlayId(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        settingsExportVars = ('GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT',
                              'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION',)
        settingsExportDict = dict([(k, getattr(settings, k)) for k in settingsExportVars])
        return render_to_response('geocamTiePoint/overlay-view.html',
                                  {'overlay': overlay,
                                   'overlayJson': dumps(overlay.jsonDict),
                                   'settings': dumps(settingsExportDict)},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


def overlayIdPreview(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        settingsExportVars = ('STATIC_URL',)
        settingsExportDict = dict([(k, getattr(settings, k)) for k in settingsExportVars])
        import sys
        print >> sys.stderr, 'overlay:', dumps(overlay.jsonDict)
        return render_to_response('geocamTiePoint/overlay-preview.html',
                                  {'overlay': overlay,
                                   'overlayJson': dumps(overlay.jsonDict),
                                   'settings': dumps(settingsExportDict)},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


@csrf_exempt
def overlayIdJson(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return HttpResponse(dumps(overlay.jsonDict), content_type='application/json')
    elif request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.jsonDict = json.loads(request.raw_post_data)
        transformDict = overlay.extras.get('transform', None)
        if transformDict:
            overlay.extras.bounds = (quadTree.imageMapBounds
                                     (overlay.extras.imageSize,
                                      quadTree.makeTransform(transformDict)))
        overlay.save()
        return HttpResponse(dumps(overlay.jsonDict), content_type='application/json')
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])

@csrf_exempt
def overlayListJson(request):
    overlays = Overlay.objects.all()
    return HttpResponse(dumps( list(o.jsonDict for o in overlays) ), content_type='application/json')

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
        fobject = overlay.imageData.image.file
        response = HttpResponse(fobject.read(), content_type=overlay.imageData.contentType)
        return response
    else:
        return HttpResponseNotAllowed(['GET'])


@cache_page(3600 * 24 * 365)
def getTile(request, quadTreeId, zoom, x, y):
    quadTreeId = int(quadTreeId)
    zoom = int(zoom)
    x = int(x)
    y = int(os.path.splitext(y)[0])

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


def uiDemo(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        settingsExportVars = ('GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT',
                              'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION',)
        settingsExportDict = dict([(k, getattr(settings, k)) for k in settingsExportVars])
        return render_to_response('geocamTiePoint/uiDemo.html',
                                  {'overlayJson': dumps(overlay.jsonDict),
                                   'settings': dumps(settingsExportDict)},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


@csrf_exempt
def overlayGenerateZip(request, key):
    if request.method == 'POST':
        overlay = get_object_or_404(Overlay, key=key)
        overlay.generateExportZip()
        return HttpResponse('{"result": "ok"}',
                            content_type='application/json')
    else:
        return HttpResponseNotAllowed(['POST'])


def overlayExportZipInterface(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/exportZip.html',
                                  {'overlay': overlay,
                                   'overlayJson': dumps(overlay.jsonDict)},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


def overlayExportZip(request, key, fname):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        if not (overlay.alignedQuadTree and overlay.alignedQuadTree.exportZip):
            raise Http404('no exportZip generated for requested overlay yet')
        return HttpResponse(overlay.alignedQuadTree.exportZip.file.read(),
                            content_type='application/zip')
    else:
        return HttpResponseNotAllowed(['GET'])
