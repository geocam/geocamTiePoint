# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import json
import logging
import time
import rfc822
import urllib2
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

import PIL.Image

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseNotFound
from django.http import HttpResponseNotAllowed, Http404, HttpResponseBadRequest
from django.template import RequestContext
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.urlresolvers import reverse
from django.core.files.base import ContentFile
from django.db import transaction
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth.decorators import login_required

from geocamTiePoint import models, forms, settings
from geocamTiePoint.models import Overlay, QuadTree
from geocamTiePoint import quadTree, transform, garbage
from geocamTiePoint import anypdf as pdf

if settings.USING_APP_ENGINE:
    from google.appengine.api import backends
    from google.appengine.api import taskqueue

TRANSPARENT_PNG_BINARY = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\x00\rIDAT\x08\xd7c````\x00\x00\x00\x05\x00\x01^\xf3*:\x00\x00\x00\x00IEND\xaeB`\x82'

PDF_MIME_TYPES = ('application/pdf',
                  'application/acrobat',
                  'application/nappdf',
                  'application/x-pdf',
                  'application/vnd.pdf',
                  'text/pdf',
                  'text/x-pdf',
                  )


def transparentPngData():
    return (TRANSPARENT_PNG_BINARY, 'image/png')


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)


def export_settings(export_vars=None):
    if export_vars == None:
        export_vars = ('GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT',
                       'GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION',
                       'STATIC_URL',
                       )
    return dumps(dict([(k, getattr(settings, k)) for k in export_vars]))


@login_required
def backbone(request):
    initial_overlays = Overlay.objects.order_by('pk')
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/backbone.html',
            {
                'initial_overlays_json': dumps(list(o.jsonDict for o in initial_overlays)) if initial_overlays else [],
                'settings': export_settings(),
            },
            context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


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


def validOverlayContentType(contentType):
    if settings.PDF_IMPORT_ENABLED and contentType in PDF_MIME_TYPES:
        # this will change to False when pdf conversion goes away
        return True
    if contentType.startswith('image/'):
        return True
    return False


class ErrorJSONResponse(HttpResponse):
    """
    Packages up a form error into a JSON response that will be nice to deal with client-side.
    The errors argument expects a django forms ErrorDict object.
    If a string is given as the errors argument, the ErrorDict will be emulated.
    """
    def __init__(self, errors, *args, **kwargs):
        if isinstance(errors, basestring):
            errors = { "__all__": [errors] }
        super(ErrorJSONResponse, self).__init__(json.dumps(errors), *args, status=400, content_type="application/json", **kwargs)


def toMegaBytes(bytes):
    return '%.1d' % (bytes / (1024 * 1024))


class FieldFileLike(object):
    """
    Given a file-like object, vaguely simulate a Django FieldFile.
    """
    def __init__(self, file, content_type):
        self.file = file
        self.content_type = content_type


@transaction.commit_on_success
def overlayNewJSON(request):
    if request.method == 'POST':
        form = forms.NewImageDataForm(request.POST, request.FILES)
        if not form.is_valid():
            return ErrorJSONResponse( form.errors )
        else:
            image = None
            imageRef = form.cleaned_data['image']
            imageFB = None
            imageType = None
            imageName = None
            # test to see if there is an image file
            if imageRef:
                # file takes precedence over image url
                imageFB = imageRef.file
                imageType = imageRef.content_type
                imageName = imageRef.name
                imageSize = imageRef.size
                # 10% "grace period" on max import file size
                if imageSize > settings.MAX_IMPORT_FILE_SIZE * 1.1:
                    return ErrorJSONResponse("Your overlay image is %s MB, larger than the maximum allowed size of %s MB."
                                             % (toMegaBytes(imageSize),
                                                toMegaBytes(settings.MAX_IMPORT_FILE_SIZE)))

            else:
                # no image, proceed to check for url
                if not form.cleaned_data['imageUrl']:
                    # what did the user even do
                    return ErrorJSONResponse( "No image url in returned form data" )
                # we have a url, try to download it
                try:
                    response = urllib2.urlopen(form.cleaned_data['imageUrl'])
                except urllib2.HTTPError as e:
                    return ErrorJSONResponse( "There was a problem fetching the image at this URL." )
                if response.code != 200:
                    return ErrorJSONResponse( "There was a problem fetching the image at this URL." )
                if not validOverlayContentType(response.headers.get('content-type')):
                    # we didn't receive an image,
                    # or we did and the server didn't say so.
                    # either way we're not going to deal with it
                    logging.error( "Non-image content-type:" + response.headers['Content-Type'].split('/')[0] )
                    return ErrorJSONResponse("The file at this URL does not seem to be an image.")
                imageSize = int( response.info().get('content-length') )
                if imageSize > settings.MAX_IMPORT_FILE_SIZE:
                    return ErrorJSONResponse("The submitted file is larger than the maximum allowed size.  Maximum size is %d bytes." % settings.MAX_IMPORT_FILE_SIZE)
                imageFB = StringIO(response.read())
                imageType = response.headers['Content-Type']
                imageName = form.cleaned_data['imageUrl'].split('/')[-1]
                response.close()

            imageData = models.ImageData(contentType=imageType)

            bits = imageFB.read()
            if imageType in PDF_MIME_TYPES:
                if not settings.PDF_IMPORT_ENABLED:
                    return ErrorJSONResponse("PDF images are no longer supported.")

                # convert PDF to raster image
                pngData = pdf.convertPdf(bits)
                imageData.image.save('dummy.png', ContentFile(pngData), save=False)
                imageData.contentType = 'image/png'
            else:
                try:
                    image = PIL.Image.open(StringIO(bits))
                except Exception as e:
                    logging.error( "PIL failed to open image: " + str(e) )
                    return ErrorJSONResponse("There was a problem reading the image.")
                if image.mode != 'RGBA':
                    # add alpha channel to image for better
                    # transparency handling later
                    image = image.convert('RGBA')
                    out = StringIO()
                    image.save(out, format='png')
                    convertedBits = out.getvalue()
                    logging.info('converted image to RGBA')
                    imageData.image.save('dummy.png', ContentFile(convertedBits),
                                         save=False)
                    imageData.contentType = 'image/png'
                else:
                    imageData.image.save('dummy.png', ContentFile(bits), save=False)
                    imageData.contentType = imageType

            # create and save new empty overlay so we can refer to it
            # this causes a ValueError if the user isn't logged in
            overlay = models.Overlay(author=request.user,
                                     isPublic=settings.GEOCAM_TIE_POINT_PUBLIC_BY_DEFAULT)
            overlay.save()
            imageData.overlay = overlay
            imageData.save()

            if image is None:
                image = PIL.Image.open(imageData.image.file)

            # fill in overlay info
            overlay.name = imageName
            overlay.imageData = imageData
            overlay.extras.points = []
            overlay.extras.imageSize = image.size
            overlay.save()

            # generate initial quad tree
            overlay.generateUnalignedQuadTree()

            # respond with json
            data = {'status': 'success', 'id': overlay.key}
            return HttpResponse(json.dumps(data))
    else:
        return HttpResponseNotAllowed(('POST'))


@csrf_exempt
def overlayIdJson(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return HttpResponse(dumps(overlay.jsonDict), content_type='application/json')
    elif request.method in ('POST', 'PUT'):
        overlay = get_object_or_404(Overlay, key=key)
        overlay.jsonDict = json.loads(request.raw_post_data)
        transformDict = overlay.extras.get('transform')
        if transformDict:
            overlay.extras.bounds = (quadTree.imageMapBounds
                                     (overlay.extras.imageSize,
                                      transform.makeTransform(transformDict)))
            overlay.generateAlignedQuadTree()
        overlay.save()
        return HttpResponse(dumps(overlay.jsonDict), content_type='application/json')
    elif request.method == 'DELETE':
        get_object_or_404(Overlay, pk=key).delete()
        return HttpResponse("OK")
    else:
        return HttpResponseNotAllowed(['GET', 'POST', 'PUT', 'DELETE'])


@csrf_exempt
def overlayListJson(request):
    # return only the last 100 overlays for now.  if it gets longer than that, we'll implement paging.
    overlays = Overlay.objects.order_by('-lastModifiedTime')[:100]

    return HttpResponse(dumps(list(o.jsonDict for o in overlays)), content_type='application/json')


def overlayIdImageFileName(request, key, fileName):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        fobject = overlay.imageData.image.file
        response = HttpResponse(fobject.read(), content_type=overlay.imageData.contentType)
        return response
    else:
        return HttpResponseNotAllowed(['GET'])


def getTileData(quadTreeId, zoom, x, y):
    gen = QuadTree.getGeneratorWithCache(quadTreeId)
    try:
        return gen.getTileData(zoom, x, y)
    except quadTree.ZoomTooBig:
        return transparentPngData()
    except quadTree.OutOfBounds:
        return transparentPngData()


def neverExpires(response):
    """
    Manually sets the HTTP 'Expires' header one year in the
    future. Normally the Django cache middleware handles this, but we
    are directly using the low-level cache API.

    Empirically, this *hugely* reduces the number of requests from the
    Google Maps API. One example is that zooming out one level stupidly
    loads all the tiles in the new zoom level twice if tiles immediately
    expire.
    """
    response['Expires'] = rfc822.formatdate(time.time() + 365 * 24 * 60 * 60)
    return response


def getTile(request, quadTreeId, zoom, x, y):
    quadTreeId = int(quadTreeId)
    zoom = int(zoom)
    x = int(x)
    y = int(os.path.splitext(y)[0])

    key = quadTree.getTileCacheKey(quadTreeId, zoom, x, y)
    data = cache.get(key)
    if data is None:
        logging.info('\ngetTile MISS %s\n', key)
        data = getTileData(quadTreeId, zoom, x, y)
        cache.set(key, data)
    else:
        logging.info('getTile hit %s', key)

    bits, contentType = data
    response = HttpResponse(bits, content_type=contentType)
    return neverExpires(response)


def getPublicTile(request, quadTreeId, zoom, x, y):
    cacheKey = 'geocamTiePoint.QuadTree.isPublic.%s' % quadTreeId
    quadTreeIsPublic = cache.get(cacheKey)
    if quadTreeIsPublic is None:
        logging.info('getPublicTile MISS %s', cacheKey)
        try:
            q = QuadTree.objects.get(id=quadTreeId)
            overlay = q.alignedOverlays.get()
        except ObjectDoesNotExist:
            overlay = None
        if overlay:
            quadTreeIsPublic = overlay.isPublic
        else:
            quadTreeIsPublic = False
        cache.set(cacheKey, quadTreeIsPublic, 60)
    else:
        logging.info('getPublicTile hit %s', cacheKey)

    if quadTreeIsPublic:
        return getTile(request, quadTreeId, zoom, x, y)
    else:
        return HttpResponseNotFound('QuadTree %s does not exist or is not public'
                                    % quadTreeId)


def dummyView(*args, **kwargs):
    return HttpResponseNotFound()


@csrf_exempt
def overlayGenerateExport(request, key):
    if request.method == 'GET':
        return (HttpResponse
                ('<form action="." method="post">'
                 + '<input type="submit" name="submit"'
                 + ' value="Create Export Archive"/>'
                 + '</form>'))
    elif request.method == 'POST':
        if settings.USING_APP_ENGINE:
            onFrontEndInstance = (backends.get_backend() == None)
            if onFrontEndInstance:
                # on app engine, quadTree generation may take too long
                # for a frontend instance, so we pass it to a backend
                taskqueue.add(url='/backend' + request.path,
                              target='processing')
                return HttpResponse('{"result": "ok"}',
                                    content_type='application/json')
        overlay = get_object_or_404(Overlay, key=key)
        overlay.generateExport()
        return HttpResponse('{"result": "ok"}',
                            content_type='application/json')
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])


def overlayExportInterface(request, key):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return render_to_response('geocamTiePoint/export.html',
                                  {'overlay': overlay,
                                   'overlayJson': dumps(overlay.jsonDict)},
                                  context_instance=RequestContext(request))
    else:
        return HttpResponseNotAllowed(['GET'])


def overlayExport(request, key, fname):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        if not (overlay.alignedQuadTree and overlay.alignedQuadTree.exportZip):
            raise Http404('no export archive generated for requested overlay yet')
        return HttpResponse(overlay.alignedQuadTree.exportZip.file.read(),
                            content_type='application/x-tgz')
    else:
        return HttpResponseNotAllowed(['GET'])


@csrf_exempt
def garbageCollect(request, dryRun='1'):
    if request.method == 'GET':
        return render_to_response('geocamTiePoint/gc.html',
                                  {},
                                  context_instance=RequestContext(request))
    elif request.method == 'POST':
        dryRun = int(dryRun)
        garbage.garbageCollect(dryRun)
        return HttpResponse('{"result": "ok"}', content_type='application/json')
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])


def simpleAlignedOverlayViewer(request, key, slug=None):
    if request.method == 'GET':
        overlay = get_object_or_404(Overlay, key=key)
        return HttpResponse(overlay.getSimpleAlignedOverlayViewer(request))
    else:
        return HttpResponseNotAllowed(['GET'])
