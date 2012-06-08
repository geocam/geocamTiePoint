# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseRedirect
from django.http import HttpResponseForbidden, Http404
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
import json

def index(request):
    """ The main view """
    return HttpResponseForbidden

def tie(request):
    """ View that deals with tie points """
    command = request.REQUEST['command']
    print "got %s command" % command
    return HttpResponse('{"result":"error"}')

def tform(request):
    """ View that deals with transform points """
    command = request.REQUEST['command']
    print "got %s command" % command
    return HttpResponse('{"result":"error"}')

def images(request):
    """ Vew that deals with images """
    command = request.REQUEST['command']
    print "got %s command" % command
    return HttpResponse('{request:"error"}')
