# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('',
    url(r'^$', 'geocamTiePoint.views.index'),
    url(r'^new$', 'geocamTiePoint.views.overlayNew'),
    url(r'^(?P<key>\d+)$', 'geocamTiePoint.views.overlayId'),
    url(r'^(?P<key>\d+).json$', 'geocamTiePoint.views.overlayIdJson'),
    url(r'^(?P<key>\d+)/warp$', 'geocamTiePoint.views.overlayIdWarp'),
    url(r'^(?P<key>\d+)/(?P<fileName>\w+)$',
        'geocamTiePoint.views.overlayIdImageFileName'),
)
