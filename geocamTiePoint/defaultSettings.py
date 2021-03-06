# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

MAX_IMPORT_FILE_SIZE = 2097152  # bytes

# This feature is rigged to be disabled due to the planned removal of the Appengine PDF service
PDF_IMPORT_ENABLED = True

# default initial viewport for alignment interface. if we can detect the
# user's position we'll use that instead. these bounds cover the
# continental US.
GEOCAM_TIE_POINT_DEFAULT_MAP_VIEWPORT = {
    "west": -130,
    "south": 22,
    "east": -59,
    "north": 52,
}

# set to 'INFO' or 'DEBUG' to get more debug information from L-M optimizer
GEOCAM_TIE_POINT_OPTIMIZE_LOG_LEVEL = 'WARNING'

# once the map zoom level exceeds the resolution of the original overlay
# image, zooming further doesn't provide more information. use this
# setting to specify how many additional levels of zoom we should
# provide past that point. this setting used to affect tile generation
# but now it only affects the client-side js map controls on the
# unaligned image.
GEOCAM_TIE_POINT_ZOOM_LEVELS_PAST_OVERLAY_RESOLUTION = 2

# amount of time to retain records in the database and blob store
# after they are marked as unused.
GEOCAM_TIE_POINT_RETAIN_SECONDS = 3600

GEOCAM_TIE_POINT_LICENSE_CHOICES = (
    ('http://creativecommons.org/publicdomain/mark/1.0/',
     'Public Domain'),

    ('http://creativecommons.org/licenses/by/3.0',
     'Creative Commons CC-BY'),

    ('http://creativecommons.org/licenses/by-nd/3.0',
     'Creative Commons CC-BY-ND'),

    ('http://creativecommons.org/licenses/by-nc-sa/3.0',
     'Creative Commons CC-BY-NC-SA'),

    ('http://creativecommons.org/licenses/by-sa/3.0',
     'Creative Commons CC-BY-SA'),

    ('http://creativecommons.org/licenses/by-nc/3.0',
     'Creative Commons CC-BY-NC'),

    ('http://creativecommons.org/licenses/by-nc-nd/3.0',
     'Creative Commons CC-BY-NC-ND'),

    )

# controls the default setting of the isPublic field on overlays.
# aligned tiles from public overlays can be viewed by any non-logged-in
# user, even though the app is in private beta.
GEOCAM_TIE_POINT_PUBLIC_BY_DEFAULT = True
