# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.contrib import admin

from geocamTiePoint import models

admin.site.register(models.Overlay)
admin.site.register(models.QuadTree)
