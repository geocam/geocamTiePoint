# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os

import PIL.Image

from django.db import models
from django.core.urlresolvers import reverse

from geocamUtil import anyjson as json

from geocamTiePoint import quadTree, settings


def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/' + filename


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)


class QuadTree(models.Model):
    overlay = models.ForeignKey('Overlay', null=True, db_index=True,
                                on_delete=models.SET_NULL  # avoid circular FK constraints making deletes impossible
                                )
    # transform is either an empty string (simple quadTree) or a JSON-formatted
    # definition of the warping transform (warped quadTree)
    transform = models.TextField(blank=True)

    def getBasePath(self):
        return settings.DATA_ROOT + 'geocamTiePoint/tiles/%d' % self.id

    def getGenerator(self):
        image = PIL.Image.open(self.overlay.image.file)
        if self.transform:
            return quadTree.WarpedQuadTreeGenerator(image, json.loads(self.transform))
        else:
            return quadTree.SimpleQuadTreeGenerator(image)


# FIX: may want to pull out Overlay.image field into a separate model to
# support versioning:

# class OverlayImage(models.Model):
#    image = models.ImageField(upload_to=getNewImageFileName)


class Overlay(models.Model):
    data = models.TextField()
    image = models.ImageField(upload_to=getNewImageFileName)
    imageType = models.CharField(max_length=50)
    name = models.CharField(max_length=50)
    key = models.AutoField(primary_key=True, unique=True)
    unalignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                          related_name='unaligned_overlays')
    alignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                        related_name='aligned_overlays')

    class Meta:
        ordering = ['-key']

    def __str__(self):
        return str(self.name)

    def __unicode__(self):
        return unicode(self.name)

    def delete(self, *args, **kwargs):
        self.image.delete()
        # self.last_quadTree.delete()  # FIX: delete quadTrees associated with overlay
        super(Overlay, self).delete(*args, **kwargs)

    def generateUnalignedQuadTree(self):
        qt = QuadTree(overlay=self)
        qt.save()

        if settings.GEOCAM_TIE_POINT_PRE_GENERATE_TILES:
            gen = qt.getGenerator()
            gen.writeQuadTree(qt.getBasePath())

        self.unalignedQuadTree = qt
        self.save()

        return qt

    def generateAlignedQuadTree(self):
        data = json.loads(self.data)

        qt = QuadTree(overlay=self, transform=dumps(data['transform']))
        qt.save()

        if settings.GEOCAM_TIE_POINT_PRE_GENERATE_TILES:
            gen = qt.getGenerator()
            gen.writeQuadTree(qt.getBasePath())

        self.alignedQuadTree = qt
        data['alignedTilesUrl'] = reverse('geocamTiePoint_tileRoot', args=[qt.id])
        self.data = dumps(data)
        self.save()

        if 0:
            import tarfile
            # figure tar file stuff out again later
            tarFilePath = settings.DATA_ROOT + 'geocamTiePoint/tileArchives/'
            if not os.path.exists(tarFilePath):
                os.makedirs(tarFilePath)
            oldPath = os.getcwd()
            os.chdir(qt.getBasePath())
            tarFile = tarfile.open(tarFilePath + '/' + str(self.key) + '.tar.gz', 'w:gz')
            for name in os.listdir(os.getcwd()):
                tarFile.add(name)
            os.chdir(oldPath)
            tarFile.close()

        return qt
