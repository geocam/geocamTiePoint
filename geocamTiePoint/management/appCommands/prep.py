# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
This is a place to put any prep code you need to run before your app
is ready.

For example, you might need to render some icons.  The convention for
that is to put the source data in your app's media_src directory and
render the icons into your app's build/media directory (outside version
control).

How this script gets run: when the site admin runs "./manage.py prep",
one of the steps is "prepapps", which calls
management/appCommands/prep.py command for each app (if it exists).
"""

from django.core.management.base import NoArgsCommand


class Command(NoArgsCommand):
    help = 'Prep geocamTiePoint'

    def handle_noargs(self, **options):
        # put your code here
        pass
