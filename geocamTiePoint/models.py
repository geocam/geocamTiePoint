# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models
from geocamTiePoint import settings
from django.core.files.storage import FileSystemStorage
from jsonfield import JSONField

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
    last_quadtree = models.ForeignKey(Overlay, blank=True)

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
        self.last_quadtree = QuadTree(overlay=self))

class QuadTree(models.Model):
    overlay = models.ForeignKey(Overlay, on_delete=Models.SET_NULL) # avoid circular FK constraints making deletes impossible
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

        if image.size[0] > image.size[1]:
            maxZoom = int(math.ceil(math.log(image.size[0]/TILE_SIZE,2)))
        else:
            maxZoom = int(math.ceil(math.log(image.size[1]/TILE_SIZE,2)))
        for i in xrange(maxZoom, -1, -1):
            nx = int(math.ceil(image.size[0]/TILE_SIZE))
            ny = int(math.ceil(image.size[1]/TILE_SIZE))
            for ix in xrange(nx):
                for iy in xrange(ny):
                    if testOutsideImage((TILE_SIZE*ix,TILE_SIZE*iy),coords) and\
                            testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*iy),coords) and\
                            testOutsideImage((TILE_SIZE*ix,TILE_SIZE*(iy+1)),coords) and\
                            testOutsideImage((TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)),coords):
                        continue
                    if not os.path.exists(basePath+'/%s/%s/' % (i+ZOOM_OFFSET,ix)):
                        os.makedirs(basePath+'/%s/%s' % (i+ZOOM_OFFSET,ix))
                    corners = [TILE_SIZE*ix,TILE_SIZE*iy,TILE_SIZE*(ix+1),TILE_SIZE*(iy+1)]
                    corners = [int(round(x)) for x in corners]
                    newImage = image.crop(corners)
                    newImage.save(basePath+'/%s/%s/%s.jpg' % (i+ZOOM_OFFSET,ix,iy))
            image = image.resize((int(math.ceil(image.size[0]/2.)),
                                  int(math.ceil(image.size[1]/2.))),
                                 Image.ANTIALIAS)
