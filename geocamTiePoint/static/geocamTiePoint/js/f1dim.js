function f1dim(x) 
{
    var xt=new Array(ncom);
    for (var i=0; i<ncom; i++) {
        xt[i] = pcom[i]+x*xicom[i];
    }
    return func(xt);
}
