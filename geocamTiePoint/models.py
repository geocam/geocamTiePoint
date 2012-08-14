# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import datetime

import PIL.Image

from django.db import models
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User

from geocamUtil import anyjson as json

from geocamTiePoint import quadTree, settings


def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/' + filename


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)


class ImageData(models.Model):
    mtime = models.DateTimeField()
    # image.max_length needs to be long enough to hold a blobstore key
    image = models.ImageField(upload_to=getNewImageFileName,
                              max_length=255)
    contentType = models.CharField(max_length=50)
    overlay = models.ForeignKey('Overlay', null=True, blank=True)
    checksum = models.CharField(max_length=128, blank=True)

    def __unicode__(self):
        if self.overlay:
            overlay_id = self.overlay.key
        else:
            overlay_id = None
        return ('ImageData overlay_id=%s checksum=%s %s'
                % (overlay_id, self.checksum, self.mtime))

    def save(self, *args, **kwargs):
        self.mtime = datetime.datetime.utcnow()
        super(ImageData, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self.image.delete()
        super(ImageData, self).delete(*args, **kwargs)


class QuadTree(models.Model):
    mtime = models.DateTimeField()
    imageData = models.ForeignKey('ImageData', null=True, blank=True)
    # transform is either an empty string (simple quadTree) or a JSON-formatted
    # definition of the warping transform (warped quadTree)
    transform = models.TextField(blank=True)

    def __unicode__(self):
        return ('QuadTree imageData_id=%s transform=%s %s'
                % (self.imageData.id, self.transform, self.mtime))

    def save(self, *args, **kwargs):
        self.mtime = datetime.datetime.utcnow()
        super(QuadTree, self).save(*args, **kwargs)

    def getBasePath(self):
        return settings.DATA_ROOT + 'geocamTiePoint/tiles/%d' % self.id

    def getGenerator(self):
        image = PIL.Image.open(self.imageData.image.file)
        if self.transform:
            return quadTree.WarpedQuadTreeGenerator(image, json.loads(self.transform))
        else:
            return quadTree.SimpleQuadTreeGenerator(image)


class Overlay(models.Model):
    key = models.AutoField(primary_key=True, unique=True)
    author = models.ForeignKey(User, null=True, blank=True)
    mtime = models.DateTimeField()
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    imageUrl = models.URLField(blank=True, verify_exists=False)
    imageData = models.ForeignKey(ImageData, null=True, blank=True,
                                  related_name='currentOverlays',
                                  on_delete=models.SET_NULL)
    unalignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                          related_name='unalignedOverlays',
                                          on_delete=models.SET_NULL)
    alignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                        related_name='alignedOverlays',
                                        on_delete=models.SET_NULL)

    # data is a special JSON-format field that redundantly holds many of
    # the specific fields defined above in the django model as well as
    # some additional fields not captured in the model schema.
    data = models.TextField()

    class Meta:
        ordering = ['-key']

    def __unicode__(self):
        return ('Overlay name=%s author=%s %s'
                % (self.name, self.author.username, self.mtime))

    def save(self, *args, **kwargs):
        self.mtime = datetime.datetime.utcnow()
        super(Overlay, self).save(*args, **kwargs)

    def generateUnalignedQuadTree(self):
        qt = QuadTree(imageData=self.imageData)
        qt.save()

        if settings.GEOCAM_TIE_POINT_PRE_GENERATE_TILES:
            gen = qt.getGenerator()
            gen.writeQuadTree(qt.getBasePath())

        self.unalignedQuadTree = qt
        data = json.loads(self.data)
        data['tilesUrl'] = reverse('geocamTiePoint_tileRoot', args=[qt.id])
        self.data = dumps(data)
        self.save()

        return qt

    def generateAlignedQuadTree(self):
        data = json.loads(self.data)

        qt = QuadTree(imageData=self.imageData,
                      transform=dumps(data['transform']))
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
