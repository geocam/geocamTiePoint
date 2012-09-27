// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

// This library implements a generic undo/redo pattern similar to how
// Emacs undo works.  You need to implement the functions getState() and
// setState(). getState() should capture your interface state into an
// object suitable for JSON serialization, and setState() should set the
// interface state using the same type of object returned by getState().


// global GetState and Setstate stubs should be overridden in application code.
if (_.isUndefined(window.getState) ) {
    window.getState = function(){ console.log("getState stub was called."); return {}; };
}
if (_.isUndefined(window.setState) ) {
    window.setState = function(state){ console.log("setState stub was called."); };
}

var undoStackG = [];
var redoStackG = [];

function getStateJson() {
    return JSON.stringify(getState());
}

function setStateJson(stateJson) {
    setState(JSON.parse(stateJson));
}

function pushState(stack) {
    stack.push(getStateJson());
}

function popState(stack) {
    setStateJson(stack.pop());
}

function undo() {
    if (undoStackG.length < 1) return;
    pushState(redoStackG);
    popState(undoStackG);
}

function redo() {
    if (redoStackG.length < 1) return;
    pushState(undoStackG);
    popState(redoStackG);
}

function actionPerformed() {
    if (redoStackG.length > 0) {
        for (var i = 0; i < redoStackG.length; i++) {
            undoStackG.push(redoStackG.pop());
        }
    }
    pushState(undoStackG);
}

