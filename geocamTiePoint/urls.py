# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns(
    'geocamTiePoint.views',

    url(r'^$', 'overlayIndex',
        {}, 'geocamTiePoint_overlayIndex'),

    url(r'^new/$', 'overlayNew',
        {}, 'geocamTiePoint_overlayNew'),

    url(r'^(?P<key>\d+)/$', 'overlayId',
        {}, 'geocamTiePoint_overlayId'),

    url(r'^(?P<key>\d+).json$', 'overlayIdJson',
        {}, 'geocamTiePoint_overlayIdJson'),

    url(r'^(?P<key>\d+)/warp/$', 'overlayIdWarp',
        {}, 'geocamTiePoint_overlayIdWarp'),

    url(r'^(?P<key>\d+)/delete/$', 'overlayDelete',
        {}, 'geocamTiePoint_overlayDelete'),

    url(r'^(?P<key>\d+)/preview/$', 'overlayIdPreview',
        {}, 'geocamTiePoint_overlayIdPreview'),

    url(r'^(?P<key>\d+)/(?P<fileName>\S+)$',
        'overlayIdImageFileName',
        {}, 'geocamTiePoint_overlayIdImageFileName'),

)
