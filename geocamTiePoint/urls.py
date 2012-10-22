# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import url, patterns
from django.shortcuts import redirect
from django.core.urlresolvers import reverse

urlpatterns = patterns(
    'geocamTiePoint.views',

    ## New Workflow ##
    url(r'^$', 'backbone',
        {}, 'geocamTiePoint_backbone'),

    url(r'^overlays/new\.json$', 'overlayNewJSON',
        {}, 'geocamTiePoint_overlayNew_JSON'),

    ## Urls to make current pages work with new workflow ##
    url(r'^overlays/list\.html$', lambda request: redirect(reverse('geocamTiePoint_backbone')+'#overlays/'),
        {}, 'geocamTiePoint_overlayIndex'),

    url(r'^overlays/new\.html$', lambda request: redirect(reverse('geocamTiePoint_backbone')+'#overlays/new'),
        {}, 'geocamTiePoint_overlayNew'),

    ## Old Client ##
    url(r'^old/overlays/list\.html$', 'overlayIndex',
        {}, 'geocamTiePoint_overlayIndex_old'),

    url(r'^old/overlays/new\.html$', 'overlayNew',
        {}, 'geocamTiePoint_overlayNew_old'),

    url(r'^overlay/(?P<key>\d+)\.html$', 'overlayId',
        {}, 'geocamTiePoint_overlayId'),

    url(r'^overlay/(?P<key>\d+)/warp$', 'overlayIdWarp',
        {}, 'geocamTiePoint_overlayIdWarp'),

    url(r'^overlay/(?P<key>\d+)/generateExport$', 'overlayGenerateExport',
        {}, 'geocamTiePoint_overlayGenerateExport'),

    # duplicate url that starts with 'backend' so we can set 'login: admin'
    # on the backend version of the view.
    url(r'^backend/overlay/(?P<key>\d+)/generateExport$', 'overlayGenerateExport',
        {}, 'geocamTiePoint_overlayGenerateExportBackend'),

    url(r'^overlay/(?P<key>\d+)/export\.html$', 'overlayExportInterface',
        {}, 'geocamTiePoint_overlayExportInterface'),

    url(r'^overlay/(?P<key>\d+)/export/(?P<fname>[^/]*)$', 'overlayExport',
        {}, 'geocamTiePoint_overlayExport'),

    url(r'^overlay/(?P<key>\d+)/delete\.html$', 'overlayDelete',
        {}, 'geocamTiePoint_overlayDelete'),

    url(r'^overlay/(?P<key>\d+)/preview\.html$', 'overlayIdPreview',
        {}, 'geocamTiePoint_overlayIdPreview'),

    url(r'^overlay/(?P<key>\d+)/simpleViewer_(?P<slug>[^/\.]*)\.html$', 'simpleAlignedOverlayViewer',
        {}, 'geocamTiePoint_simpleAlignedOverlayViewer'),

    ## Image storage pass-thru ##
    url(r'^tile/(?P<quadTreeId>\d+)/$',
        'dummyView',
        {}, 'geocamTiePoint_tileRoot'),

    url(r'^tile/(?P<quadTreeId>[^/]+)/(?P<zoom>[^/]+)/(?P<x>[^/]+)/(?P<y>[^/]+)$',
        'getTile',
        {}, 'geocamTiePoint_tile'),

    url(r'^public/tile/(?P<quadTreeId>[^/]+)/(?P<zoom>[^/]+)/(?P<x>[^/]+)/(?P<y>[^/]+)$',
        'getPublicTile',
        {}, 'geocamTiePoint_publicTile'),

    url(r'^overlay/(?P<key>\d+)/(?P<fileName>\S+)$',
        'overlayIdImageFileName',
        {}, 'geocamTiePoint_overlayIdImageFileName'),

    ## New Client ##
    url(r'^ember/', 'ember',
        {}, 'geocamTiePoint_ember'),

    url(r'^backbone/', 'backbone',
        {}, 'geocamTiePoint_backbone'),

    ## JSON API ##
    url(r'^overlay/(?P<key>\d+).json$', 'overlayIdJson',
        {}, 'geocamTiePoint_overlayIdJson'),

    ## testing ui demo ##
    url(r'^uiDemo/(?P<key>\d+)/$', 'uiDemo',
        {}, 'geocamTiePoint_uiDemo'),

    url(r'^overlays\.json$', 'overlayListJson',
        {}, 'geocamTiePoint_overlayListJson'),

    url(r'^gc/(?:(?P<dryRun>\d+)/)?$', 'garbageCollect',
        {}, 'geocamTiePoint_garbageCollect'),
)
