# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.contrib import admin

from geocamTiePoint.models import Overlay

class OverlayAdmin(admin.ModelAdmin):
    list_display = ('data','image','key','imageType')

admin.site.register(Overlay, OverlayAdmin)
