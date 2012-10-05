# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# Instance of X has no 'Y' member (false alarm for abstract classes)
# pylint: disable=E1101

import logging
import datetime

from geocamTiePoint.models import Overlay, QuadTree, ImageData
from geocamTiePoint import settings

RETAIN_TIME = datetime.timedelta(seconds=settings.GEOCAM_TIE_POINT_RETAIN_SECONDS)


def getActiveQuadTreeIds():
    activeIds = set()

    overlays = (Overlay.objects
                .all()
                .only('unalignedQuadTree', 'alignedQuadTree'))
    for o in overlays:
        activeIds.add(o.unalignedQuadTree_id)
        activeIds.add(o.alignedQuadTree_id)

    activeIds.discard(None)  # ignore null values

    return activeIds


def getActiveImageDataIds():
    activeIds = set()

    overlays = (Overlay.objects
                .all()
                .only('imageData'))
    for o in overlays:
        activeIds.add(o.imageData_id)

    quadTrees = (QuadTree.objects
                 .all()
                 .only('imageData'))
    for q in quadTrees:
        activeIds.add(q.imageData_id)

    activeIds.discard(None)  # ignore null values

    return activeIds


def getActiveFiles():
    activeFiles = set()

    quadTrees = (QuadTree.objects
                 .all()
                 .only('exportZip'))
    for q in quadTrees:
        if q.exportZip:
            activeFiles.add(q.exportZip.name)

    imageRecs = (ImageData.objects
                 .all()
                 .only('image'))
    for r in imageRecs:
        if r.image:
            activeFiles.add(r.image)

    return activeFiles


def markOthersUnused(model, activeIdsFunc, dryRun=True):
    allIds = set([r.id for r in model.objects.all().only('id')])
    activeIds = activeIdsFunc()
    unusedIds = allIds.difference(activeIds)

    logging.info('markOthersUnused %s: numUsed=%s numUnused=%s',
                 model.__name__, len(activeIds), len(unusedIds))

    unusedRecords = (model.objects
                     .only('unusedTime')
                     .in_bulk(unusedIds))

    numUpdated = 0
    for r in unusedRecords.itervalues():
        if r.unusedTime is None:
            r.unusedTime = datetime.datetime.utcnow()
            if not dryRun:
                r.save()
            numUpdated += 1

    logging.info('markOthersUnused %s: numUpdated=%s',
                 model.__name__, numUpdated)
    if dryRun:
        logging.warning('markOthersUnused %s: dry run mode, nothing actually saved',
                        model.__name__)


def deleteUnusedPastRetainTime(model, dryRun=True):
    marked = (model.objects
              .all()
              .filter(unusedTime__isnull=False)
              .only('unusedTime'))
    now = datetime.datetime.utcnow()
    numDeleted = 0
    logging.debug('deleteUnusedPastRetainTime %s: numMarked=%s',
                  model.__name__, len(marked))
    for q in marked:
        doDelete = (now - q.unusedTime > RETAIN_TIME)
        logging.debug('  %s: unusedDelta=%s RETAIN_TIME=%s doDelete=%s',
                      model.__name__,
                      now - q.unusedTime,
                      RETAIN_TIME,
                      doDelete)
        if doDelete:
            if not dryRun:
                q.delete()
            numDeleted += 1

    logging.info('deleteUnusedPastRetainTime %s: numMarked=%s numDeleted=%s',
                 model.__name__, len(marked), numDeleted)
    if dryRun:
        logging.warning('deleteUnusedPastRetainTime %s: dry run mode, nothing actually deleted',
                        model.__name__)


def deleteOtherFiles(activeFiles, dryRun=True):
    if not settings.USING_APP_ENGINE:
        logging.warning('deleteOtherFiles: only implemented for appengine blobstore')
        return

    from google.appengine.ext import blobstore

    numBlobs = 0
    numDeleted = 0
    for blob in blobstore.BlobInfo.all():
        numBlobs += 1
        if str(blob.key()) not in activeFiles:
            if not dryRun:
                blob.delete()
            numDeleted += 1

    logging.info('deleteOtherFiles: numBlobs=%s numActiveFiles=%s numDeleted=%s',
                 numBlobs, len(activeFiles), numDeleted)
    if dryRun:
        logging.warning('deleteOtherFiles: dry run mode, nothing actually deleted')


def garbageCollect(dryRun=True):
    markOthersUnused(QuadTree, getActiveQuadTreeIds, dryRun=dryRun)
    deleteUnusedPastRetainTime(QuadTree, dryRun=dryRun)

    markOthersUnused(ImageData, getActiveImageDataIds, dryRun=dryRun)
    deleteUnusedPastRetainTime(ImageData, dryRun=dryRun)

    activeFiles = getActiveFiles()
    deleteOtherFiles(activeFiles, dryRun=dryRun)
