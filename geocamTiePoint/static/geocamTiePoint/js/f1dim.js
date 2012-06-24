function f1dim(x,ncom,pcom,xicom,points) 
{
    var xt=new Array(ncom);
    for (var i=0; i<ncom; i++) {
        xt[i] = pcom[i]+x*xicom[i];
    }
    return func(xt,ncom,pcom,xicom,points);
}
