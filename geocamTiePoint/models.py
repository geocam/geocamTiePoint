# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models

def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/'+filename

class Overlay(models.Model):
    data = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to=getNewImageFileName,
                              blank=True, null=True)
    imageType = models.CharField(max_length=50)
    key = models.AutoField(primary_key=True, unique=True)

    class Meta:
        ordering = ['-key']
