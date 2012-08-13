# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms
from geocamTiePoint import models


class NewOverlayForm(forms.ModelForm):
    class Meta:
        model = models.Overlay
        fields = ('image',)
