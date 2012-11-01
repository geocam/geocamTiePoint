#!/usr/bin/env python
# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from geocamTiePoint.models import Overlay


def doubleImageSize(overlayId):
    ov = Overlay.objects.get(key=overlayId)
    meta = ov.getJsonDict()
    for pt in meta['points']:
        pt[2] = pt[2] * 2
        pt[3] = pt[3] * 2
    ov.setJsonDict(meta)
    ov.save()


def main():
    import optparse
    parser = optparse.OptionParser('usage: doubleImageSize.py <overlayId>')
    _opts, args = parser.parse_args()
    if len(args) != 1:
        parser.error('expected exactly 1 arg')
    doubleImageSize(args[0])


if __name__ == '__main__':
    main()
