# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# avoid warnings due to pylint not understanding DotDict objects
# pylint: disable=E1101

import os
import datetime

import PIL.Image

from django.db import models
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User

from geocamUtil import anyjson as json
from geocamUtil.models.ExtrasDotField import ExtrasDotField

from geocamTiePoint import quadTree, settings


def getNewImageFileName(instance, filename):
    return 'geocamTiePoint/overlay_images/' + filename


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=4)


class MissingData(object):
    pass
MISSING = MissingData()


class ImageData(models.Model):
    lastModifiedTime = models.DateTimeField()
    # image.max_length needs to be long enough to hold a blobstore key
    image = models.ImageField(upload_to=getNewImageFileName,
                              max_length=255)
    contentType = models.CharField(max_length=50)
    overlay = models.ForeignKey('Overlay', null=True, blank=True)
    checksum = models.CharField(max_length=128, blank=True)
    # we set unusedTime when a QuadTree is no longer referenced by an Overlay.
    # it will eventually be deleted.
    unusedTime = models.DateTimeField(null=True, blank=True)

    def __unicode__(self):
        if self.overlay:
            overlay_id = self.overlay.key
        else:
            overlay_id = None
        return ('ImageData overlay_id=%s checksum=%s %s'
                % (overlay_id, self.checksum, self.lastModifiedTime))

    def save(self, *args, **kwargs):
        self.lastModifiedTime = datetime.datetime.utcnow()
        super(ImageData, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self.image.delete()
        super(ImageData, self).delete(*args, **kwargs)


class QuadTree(models.Model):
    lastModifiedTime = models.DateTimeField()
    imageData = models.ForeignKey('ImageData', null=True, blank=True)
    # transform is either an empty string (simple quadTree) or a JSON-formatted
    # definition of the warping transform (warped quadTree)
    transform = models.TextField(blank=True)
    # we set unusedTime when a QuadTree is no longer referenced by an Overlay.
    # it will eventually be deleted.
    unusedTime = models.DateTimeField(null=True, blank=True)

    def __unicode__(self):
        return ('QuadTree imageData_id=%s transform=%s %s'
                % (self.imageData.id, self.transform, self.lastModifiedTime))

    def save(self, *args, **kwargs):
        self.lastModifiedTime = datetime.datetime.utcnow()
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
    lastModifiedTime = models.DateTimeField()
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    imageSourceUrl = models.URLField(blank=True, verify_exists=False)
    imageData = models.ForeignKey(ImageData, null=True, blank=True,
                                  related_name='currentOverlays',
                                  on_delete=models.SET_NULL)
    unalignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                          related_name='unalignedOverlays',
                                          on_delete=models.SET_NULL)
    alignedQuadTree = models.ForeignKey(QuadTree, null=True, blank=True,
                                        related_name='alignedOverlays',
                                        on_delete=models.SET_NULL)

    # extras: a special JSON-format field that holds additional
    # schema-free fields in the overlay model. Members of the field can
    # be accessed using dot notation. currently used extras subfields
    # include: imageSize, points, transform, bounds
    extras = ExtrasDotField()

    # import/export configuration
    exportFields = ('key', 'lastModifiedTime', 'name', 'description', 'imageSourceUrl')
    importFields = ('name', 'description', 'imageSourceUrl')
    importExtrasFields = ('points', 'transform')

    def getJsonDict(self):
        # export all schema-free subfields of extras
        result = self.extras.copy()

        # export other schema-controlled fields of self (listed in exportFields)
        for key in self.exportFields:
            val = getattr(self, key, None)
            if val not in ('', None):
                result[key] = val

        # conversions
        result['lastModifiedTime'] = (result['lastModifiedTime']
                                      .replace(microsecond=0)
                                      .isoformat()
                                      + 'Z')

        # calculate and export urls for client convenience
        result['url'] = reverse('geocamTiePoint_overlayIdJson', args=[self.key])
        if self.unalignedQuadTree is not None:
            result['unalignedTilesUrl'] = reverse('geocamTiePoint_tile',
                                                  args=[str(self.unalignedQuadTree.id),
                                                        '[ZOOM]',
                                                        '[X]',
                                                        '[Y].jpg'])
            result['unalignedTilesZoomOffset'] = quadTree.ZOOM_OFFSET
        if self.alignedQuadTree is not None:
            result['alignedTilesUrl'] = reverse('geocamTiePoint_tile',
                                                args=[str(self.alignedQuadTree.id),
                                                      '[ZOOM]',
                                                      '[X]',
                                                      '[Y].png'])

        return result

    def setJsonDict(self, jsonDict):
        # set schema-controlled fields of self (listed in
        # self.importFields)
        for key in self.importFields:
            val = jsonDict.get(key, MISSING)
            if val is not MISSING:
                setattr(self, key, val)

        # set schema-free subfields of self.extras (listed in
        # self.importExtrasFields)
        for key in self.importExtrasFields:
            val = jsonDict.get(key, MISSING)
            if val is not MISSING:
                self.extras[key] = val

    jsonDict = property(getJsonDict, setJsonDict)

    class Meta:
        ordering = ['-key']

    def __unicode__(self):
        return ('Overlay name=%s author=%s %s'
                % (self.name, self.author.username, self.lastModifiedTime))

    def save(self, *args, **kwargs):
        self.lastModifiedTime = datetime.datetime.utcnow()
        super(Overlay, self).save(*args, **kwargs)

    def generateUnalignedQuadTree(self):
        qt = QuadTree(imageData=self.imageData)
        qt.save()

        if settings.GEOCAM_TIE_POINT_PRE_GENERATE_TILES:
            gen = qt.getGenerator()
            gen.writeQuadTree(qt.getBasePath())

        self.unalignedQuadTree = qt
        self.save()

        return qt

    def generateAlignedQuadTree(self):
        qt = QuadTree(imageData=self.imageData,
                      transform=dumps(self.extras.transform))
        qt.save()

        if settings.GEOCAM_TIE_POINT_PRE_GENERATE_TILES:
            gen = qt.getGenerator()
            gen.writeQuadTree(qt.getBasePath())

        self.alignedQuadTree = qt
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
