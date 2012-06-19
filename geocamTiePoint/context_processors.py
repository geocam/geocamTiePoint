from django.conf import settings

def static(request):
    return {"STATIC_URL":settings.MEDIA_URL,
            "DATA_URL":settings.DATA_URL}
