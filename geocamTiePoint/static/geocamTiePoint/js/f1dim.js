// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

function f1dim(x,ncom,pcom,xicom,points) 
{
    var xt=new Array(ncom);
    for (var i=0; i<ncom; i++) {
        xt[i] = pcom[i]+x*xicom[i];
    }
    return func(xt,ncom,pcom,xicom,points);
}
