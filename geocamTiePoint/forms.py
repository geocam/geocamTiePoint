# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms
from django.forms import ValidationError


class NewImageDataForm(forms.Form):
    image = forms.FileField(required=False)
    imageUrl = forms.URLField(required=False)

    def clean(self):
        cleaned_data = super(NewImageDataForm, self).clean()

        image_file = cleaned_data.get("image")
        image_url = cleaned_data.get("imageUrl")

        if not bool(image_file) ^ bool(image_url):  # logical xor
            raise ValidationError("Requires a URL or uploaded image, but not both.")

        return cleaned_data
