# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# warnings about undefined variables within closures
# pylint: disable=E1120

# warnings about not calling parent class constructor
# pylint: disable=W0231

# warnings about not defining abstract methods from parent
# pylint: disable=W0223

import numpy
import PIL.Image
import glob, os
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

from geocamTiePoint import models, transform, settings
from geocamTiePoint.models import ImageData
from django.core.files.base import ContentFile
from geocamUtil import geomath

from geocamUtil.geom3 import Vector3, Point3, Ray3


class IssImage(object):
    
    def __init__(self, filename, cameraPosition, focalLength):
        self.imageName = filename
        self.imageType = 'JPEG'
        self.image = PIL.Image.open(filename).convert('RGBA') # sets alpha to 255
        self.width = self.image.size[0]
        self.height = self.image.size[1]
        self.opticalCenterX = int(self.width / 2.0)
        self.opticalCenterY = int(self.height / 2.0)
        self.focal_length_meters = focalLength
        self.cameraLatLongAlt = cameraPosition  # lat, long, alt


    def save(self):
        imageString = StringIO()
        self.image.save(imageString, format = self.imageType)  # saves image content in memory
        imageContent = imageString.getvalue()  # get the bits
        
        # save image contents in the 
        imageData = models.ImageData(contentType=self.imageType)
        imageData.image.save('test.jpg', ContentFile(imageContent), save=False)
        imageData.save()


    def pixelToVector(self, pixelCoord):
        """
        For transforming image 2d pixel coordinates (x,y) to
        a normalized direction vector in camera coordinates.
        
        Assumptions: 
        - optical center is center of the image
        - focal length in x is equal to focal length in y
        """
        x = (pixelCoord[0] - self.opticalCenterX) / self.focal_length_meters
        y = (pixelCoord[1] - self.opticalCenterY) / self.focal_length_meters
        z = 1
        dirVec = Vector3(x,y,z)
        print dirVec
        normDir = dirVec.norm() # double check
        print normDir
        return normDir
    
    
    @staticmethod
    def cameraToWorldCoord(cameraCoord, cameraPosition):
        """
        Transforms point from camera coord to world coordinates.
        """
        pass
    
    
    def getBboxFromImageCorners(self):
        """
        Calculate 3d world position of four image corners
        given image and camera params.
        """
        ecef = geomath.transformLonLatAltToEcef(self.cameraLatLongAlt)
        corner1 = [0,0]
        corner2 = [self.width, 0]
        corner3 = [0, self.height]
        corner4 = [self.width, self.height]
        vector1 = self.cameraCoord(self.pixelToVector(corner1))



def main():
    imageName = settings.DATA_DIR + "geocamTiePoint/overlay_images/ISS039-E-1640.JPG"    
    focalLengthMeters = 0.4
    cameraLatLongAlt = [-87.4, 29.3, 409000]  # nadir position
    issImage = IssImage(imageName, cameraLatLongAlt, focalLengthMeters)
    issImage.findBboxCoordinates()
    
main()