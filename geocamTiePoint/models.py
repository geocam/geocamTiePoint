# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models
from geocamTiePoint import settings
from django.core.files.storage import FileSystemStorage

import os, shutil

dataStorage = FileSystemStorage(location=settings.DATA_ROOT)

def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/'+filename

class Overlay(models.Model):
    data = models.TextField()
    image = models.ImageField(upload_to=getNewImageFileName,
                              storage=dataStorage)
    imageType = models.CharField(max_length=50)
    name = models.CharField(max_length=50)
    key = models.AutoField(primary_key=True, unique=True)

    class Meta:
        ordering = ['-key']

    def __str__(self):
        return str(self.name)

    def __unicode__(self):
        return unicode(self.name)

    def delete(self, *args, **kwargs):
        dataStorage.delete(self.image)
        if dataStorage.exists('geocamTiePoint/tiles/'+str(self.key)):
            shutil.rmtree(dataStorage.path('geocamTiePoint/tiles/'+str(self.key)))
        models.Model.delete(self, *args,**kwargs)
