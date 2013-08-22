#!/usr/bin/env python

"""
Generates a KML super overlay given a directory of tiles in Google Maps layout.
"""

import os
import re

from geocamTiePoint.quadTree import tileBoundsLonLat

TILE_PATH_REGEX = re.compile(r'^.*/(?P<zoom>\d+)/(?P<x>\d+)/(?P<y>\d+)\.\w+$')
IMAGE_EXTENSIONS = ('.png', '.jpg')

LINK_TEMPLATE = '''
  <NetworkLink>
    <name>{name}</name>
    <Region><LatLonAltBox><north>{north}</north><south>{south}</south><east>{east}</east><west>{west}</west></LatLonAltBox><Lod><minLodPixels>128</minLodPixels><maxLodPixels>-1</maxLodPixels></Lod></Region>
    <Link><href>{kmlUrl}</href><viewRefreshMode>onRegion</viewRefreshMode></Link>
  </NetworkLink>
'''[1:]


TILE_TEMPLATE = '''
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
<Folder>
{links}
  <GroundOverlay>
    <Region><LatLonAltBox><north>{north}</north><south>{south}</south><east>{east}</east><west>{west}</west></LatLonAltBox><Lod><minLodPixels>128</minLodPixels><maxLodPixels>1024</maxLodPixels></Lod></Region>
    <name>{name}</name>
    <Icon><href>{imageUrl}</href></Icon>
    <LatLonBox><north>{north}</north><south>{south}</south><east>{east}</east><west>{west}</west></LatLonBox>
    <drawOrder>{drawOrder}</drawOrder>
  </GroundOverlay>
</Folder>
</kml>
'''[1:]


def getImages(path):
    for root, dirs, files in os.walk(path):
        for f in files:
            ext = os.path.splitext(f)[1]
            if ext in IMAGE_EXTENSIONS:
                yield os.path.join(root, f)


def getTileIndex(path):
    m = TILE_PATH_REGEX.match(path)
    assert m
    return int(m.group('zoom')), int(m.group('x')), int(m.group('y'))


def getChildIndices(idx):
    zoom, x, y = idx
    zp = zoom + 1
    xp = 2 * x
    yp = 2 * y
    return ((zp, xp, yp),
            (zp, xp + 1, yp),
            (zp, xp, yp + 1),
            (zp, xp + 1, yp + 1))


def getLink(tiles, childIdx):
    zoom, x, y = childIdx
    ctx = {
        'name': '{}/{}/{}'.format(zoom, x, y),
        'kmlUrl': '../../{}/{}/{}.kml'.format(zoom, x, y),
    }
    ctx.update(tileBoundsLonLat(*childIdx))
    return LINK_TEMPLATE.format(**ctx)


def getChildLinks(tiles, parentIdx):
    childIndices = [i
                    for i in getChildIndices(parentIdx)
                    if i in tiles]
    return ''.join((getLink(tiles, i)
                    for i in childIndices))


def getTileKml(tiles, idx):
    imgPath = tiles[idx]
    zoom, x, y = idx
    ctx = {
        'name': '{}/{}/{}'.format(zoom, x, y),
        'links': getChildLinks(tiles, idx),
        'drawOrder': zoom,
        'imageUrl': os.path.basename(imgPath),
    }
    ctx.update(tileBoundsLonLat(*idx))
    return TILE_TEMPLATE.format(**ctx)


def genKml(path):
    tiles = dict(((getTileIndex(p), p)
                  for p in getImages(path)))
    for idx, imgPath in tiles.iteritems():
        imgNoExt = os.path.splitext(imgPath)[0]
        outPath = imgNoExt + '.kml'
        f = open(outPath, 'w')
        f.write(getTileKml(tiles, idx))
        f.close()
    print 'wrote {} kml files'.format(len(tiles))


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog <directory>\n' + __doc__)
    opts, args = parser.parse_args()
    if len(args) != 1:
        parser.error('expected exactly 1 arg')
    path = args[0]
    genKml(path)


if __name__ == '__main__':
    main()
