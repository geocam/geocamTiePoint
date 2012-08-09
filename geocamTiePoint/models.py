# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models
from geocamTiePoint import settings
from django.core.files.storage import FileSystemStorage
import os, shutil

from jsonfield import JSONField
from quadtree import makeQuadTree

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
    unaligned_quadtree = models.ForeignKey(QuadTree, blank=True)
    aligned_quadtree = models.ForeignKey(QuadTree, blank=True)

    class Meta:
        ordering = ['-key']

    def __str__(self):
        return str(self.name)

    def __unicode__(self):
        return unicode(self.name)

    def delete(self, *args, **kwargs):
        dataStorage.delete(self.image)
        self.last_quadtree.delete()
        super(self, Overlay).delete(*args, **kwargs)

    def generateQuadTree(self):
        self.unaligned_quadtree = QuadTree(overlay=self))
        self.unaligned_quadtree.generate()

class QuadTree(models.Model):
    overlay = models.ForeignKey(Overlay, null=True, on_delete=Models.SET_NULL) # avoid circular FK constraints making deletes impossible
    tiles = JSONField(null=True) # notionally a long array of tile storage keys

    def delete(self, *args, **kwargs):
        self.deleteTiles()
        self.deleteRegisteredTiles()
        self.deleteArchive()
        super(self, Quadtree).delete(*args, **kwargs)

    def deleteTiles(self):
        if dataStorage.exists('geocamTiePoint/tiles/'+str(self.pk)):
            shutil.rmtree(dataStorage.path('geocamTiePoint/tiles/'+str(self.pk)))

    def deleteRegisteredTiles(self):
        if dataStorage.exists('geocamTiePoint/registeredTiles/'+str(self.pk)):
            shutil.rmtree(dataStorage.path('geocamTiePoint/registeredTiles/'+str(self.pk)))

    def deleteArchive(self):
        if dataStorage.exists('geocamTiePoint/tileArchives/'+str(self.pk)):
            os.remove(dataStorage.path('geocamTiePoint/tileArchives/'+str(self.pk)))

    def generate(self):
        image = PIL.Image( dataStorage.Open( self.overlay.image ) )
        coords = ((0,0),(image.size[0],0),(0,image.size[1]),image.size)
        basePath = 'quadtree/' + str(self.id)
        
        tile_keys = makeQuadTree( image, coords, basePath, dataStorage)
