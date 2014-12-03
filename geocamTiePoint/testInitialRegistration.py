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

import numpy as np
import PIL.Image
import glob, os
try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

from geocamTiePoint import models, transform, settings
from geocamTiePoint.models import ImageData
from django.core.files.base import ContentFile

from geocamUtil.geom3 import Vector3, Point3, Ray3
from geocamUtil.sphere import Sphere
from geocamUtil.geomath import EARTH_RADIUS_METERS, transformLonLatAltToEcef, transformEcefToLonLatAlt

class IssImage(object):
    
    def __init__(self, filename, cameraLongitude, cameraLatitude, cameraAltitude, focalLength):
        self.imageName = filename
        self.imageType = 'JPEG'
        self.image = PIL.Image.open(filename).convert('RGBA') # sets alpha to 255
        self.width = self.image.size[0]
        self.height = self.image.size[1]
        self.opticalCenterX = int(self.width / 2.0)
        self.opticalCenterY = int(self.height / 2.0)
        self.focal_length_meters = focalLength
        self.camera_logitude = cameraLongitude
        self.camera_latitude = cameraLatitude
        self.camera_altitude = cameraAltitude

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
        normDir = dirVec.norm()
        return normDir

    
    def imageCoordToEcef(self, x, y):
        cameraPoseEcef = transformLonLatAltToEcef([self.camera_logitude, self.camera_latitude, self.camera_altitude])
        cameraPose = Point3(cameraPoseEcef[0], cameraPoseEcef[1], cameraPoseEcef[2])  # ray start is camera position in world coordinates
        
        dirVector = self.pixelToVector([x,y])  # vector from center of projection to pixel on image.
        print "dirVector %s" % str(dirVector)
        # this ray is oriented in camera coords. We need to rotate it so its frame matches that of ecef's.
        rotMatrix = np.matrix('1 2 3; 4 5 6; 7 8 9')  # dummy rotation matrix
        dirVector_np = np.array([dirVector.dx, dirVector.dy, dirVector.dx])
        #TODO: insert the rotation matrix here!!
        dirVectorAlignedWithEcefFrame_np = rotMatrix * dirVector_np
        
        ray = Ray3(cameraPose, dirVector)
        
        earthCenter = Point3(0,0,0)  # since we use ecef, earth center is 0 0 0
        earth = Sphere(earthCenter, EARTH_RADIUS_METERS)
        t = earth.intersect(ray)
        print "t: %d" % t
        if t != None:
            # convert t to ecef coords
            return ray.start + t*ray.dir
        else: 
            return None
        
        
    def getBboxFromImageCorners(self):
        """
        Calculate 3d world position of four image corners
        given image and camera params.
        """
        corner1 = [0,0]
        corner2 = [self.width, 0]
        corner3 = [0, self.height]
        corner4 = [self.width, self.height]
        
        # this returns None when there is no intersection...
        corner1_ecef = self.imageCoordToEcef(corner1[0], corner1[1])
        corner2_ecef = self.imageCoordToEcef(corner2[0], corner2[1])
        corner3_ecef = self.imageCoordToEcef(corner3[0], corner3[1])
        corner4_ecef = self.imageCoordToEcef(corner4[0], corner4[1])
        print [corner1_ecef, corner2_ecef, corner3_ecef, corner4_ecef]
        
        
def main():
    imageName = settings.DATA_DIR + "geocamTiePoint/overlay_images/ISS039-E-1640.JPG"    
    focalLengthMeters = 0.4
    issImage = IssImage(imageName, 29.3, -87.4, 409000, focalLengthMeters)
    corners = issImage.getBboxFromImageCorners()
    
    # sanity check
#     if corners[0] != None:
#         print "Corner " + corners[0] + "should equal to 29degrees 45'23.36 N, 89degrees56'52.85W "
#     if corners[1] != None:
#         print "Corner " + corners[1] + "should equal to 29 50 29 82N , 90 21 55 40W "
#     print "Corner " + str(transformEcefToLonLatAlt(corners[2])) + "should equal to 30degrees 01'03.43N, 89 51 44 15W  "
#     print "Corner " + str(transformEcefToLonLatAlt(corners[3])) + "should equal to 30 06 31 28N, 90 17 04 01 W"
#     
main()