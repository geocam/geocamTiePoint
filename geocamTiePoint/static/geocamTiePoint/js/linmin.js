//This function works!
function linmin(p,xi)
{
    var TOL = Math.pow(1.0*2.71828183,-8);
    var n = p.length;
    ncom = n;
    pcom = p;
    xicom = xi;

    var ax = 0.0;
    var xx = 1.0;
    var fret = 0;
    
    var mnbrak_ret=mnbrak(ax,xx);
    
    ax = mnbrak_ret.ax;
    xx = mnbrak_ret.bx;
    var bx = mnbrak_ret.cx;

    var golden_ret=golden(ax,xx,bx,TOL);
    var xmin = golden_ret.xmin;
    var fret = golden_ret.fret;
   
    for (var j=0; j<xi.length; j++) {
        xi[j]=xi[j]*xmin;
        p[j]=p[j]+xi[j];
    }
    
    xicom = null;
    pcom = null;
   
    return {p:p,xi:xi,fret:fret};   
}
