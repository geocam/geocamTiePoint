# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.db import models

class Point(models.Model):
    x = models.FloatField()
    y = models.FloatField()
    key = models.FloatField(primary_key=True, unique=True)

class TiePoints(models.Model):
    points = models.ManyToManyField(Point)
    key = models.FloatField(primary_key=True, unique=True)

class TransformPoints(models.Model):
    points = models.ManyToManyField(Point)
    key = models.FloatField(primary_key=True, unique=True)

class ImageFile(models.Model):
    image = models.FileField(upload_to=ImageFile.getNewFileName)
    key = models.FloatField(primary_key=True, unique=True)
