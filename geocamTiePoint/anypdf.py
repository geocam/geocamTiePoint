# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# suppress warning about wildcard imports
# pylint: disable=W0401

try:
    from geocamAppEngine.pdf import *
except ImportError:
    from geocamUtil.pdf import *
