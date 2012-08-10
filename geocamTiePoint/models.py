# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import shutil

from django.db import models
from django.core.files.storage import FileSystemStorage

from geocamUtil.models import UuidField

from geocamTiePoint import quadtree, settings

dataStorage = FileSystemStorage(location=settings.DATA_ROOT)

def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/'+filename


class QuadTree(models.Model):
    overlay = models.ForeignKey('Overlay', null=True, db_index=True,
                                on_delete=models.SET_NULL  # avoid circular FK constraints making deletes impossible
                                )
    # transform is either an empty string (simple quadtree) or a JSON-formatted
    # definition of the warping transform (warped quadtree)
    transform = models.TextField(blank=True)


class Overlay(models.Model):
    data = models.TextField()
    image = models.ImageField(upload_to=getNewImageFileName,
                              storage=dataStorage)
    imageType = models.CharField(max_length=50)
    name = models.CharField(max_length=50)
    key = models.AutoField(primary_key=True, unique=True)
    unalignedQuadtree = models.ForeignKey(QuadTree, null=True, blank=True,
                                          related_name='unaligned_overlays')
    alignedQuadtree = models.ForeignKey(QuadTree, null=True, blank=True,
                                        related_name='aligned_overlays')

    class Meta:
        ordering = ['-key']

    def __str__(self):
        return str(self.name)

    def __unicode__(self):
        return unicode(self.name)

    def delete(self, *args, **kwargs):
        dataStorage.delete(self.image)
        # self.last_quadtree.delete()  # FIX: delete quadtrees associated with overlay
        super(Overlay, self).delete(*args, **kwargs)

    def generateQuadTree(self):
        qt = QuadTree(overlay=self)
        qt.save()
        self.unalignedQuadtree = qt
        self.save()
        if 1:
            gen = quadtree.SimpleQuadTreeGenerator(self.image.path)
            basePath = settings.DATA_ROOT + 'geocamTiePoint/tiles/%d' % qt.id
            gen.writeQuadTree(basePath)
        return qt
