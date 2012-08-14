// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

function func(p,ncom,pcom,xicom,points) //p is params to tMtx
{
    var V = getVMatrixFromPoints(points);
    var tform = getTransform(p);
    var Vapprox = applyTransform(tform, points);
    var Verror = Vapprox.subtract(V);
    var error = Verror.squareSum();

    /*
    console.log('V: ' + JSON.stringify(V));
    console.log('tform: ' + JSON.stringify(tform));
    console.log('Vapprox: ' + JSON.stringify(Vapprox));
    console.log('Verror: ' + JSON.stringify(Verror));
    console.log('error: ' + error.toExponential(8));
    */

    return error;
}

