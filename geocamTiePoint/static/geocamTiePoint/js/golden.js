//This function works!

function golden(ax,bx,cx,tol,ncom,pcom,xicom,points) 
{
    var ITMAX = 100;
    var R=0.61803399;
    var C=1.0-R;
    var x0=ax;
    var x1;
    var x2;
    var x3=cx;
    var shft3_ret;
    var shft2_ret;
    
    if (Math.abs(cx-bx) > Math.abs(bx-ax)) {
        x1 = bx;
        x2 = bx+C*(cx-bx);
    } else {
        x2 = bx;
        x1 = bx-C * (bx-ax);
    }

    var f1=f1dim(x1,ncom,pcom,xicom,points);
    var f2=f1dim(x2,ncom,pcom,xicom,points);

    
    var step = 0;
    while(Math.abs(x3-x0) > tol*(Math.abs(x1)+Math.abs(x2))) {
        if (f2<f1) {
            shft3_ret = shft3(x0,x1,x2,R*x2+C*x3);
            x0 = shft3_ret.a;
            x1 = shft3_ret.b;
            x2 = shft3_ret.c;

            shft2_ret = shft2(f1,f2,f1dim(x2,ncom,pcom,xicom,points));
            f1=shft2_ret.a;
            f2=shft2_ret.b;  
        } else {
            shft3_ret = shft3(x3,x2,x1,R*x1+C*x0);
            x3=shft3_ret.a;
            x2=shft3_ret.b;
            x1=shft3_ret.c;

            shft2_ret = shft3(f2,f1,f1dim(x1,ncom,pcom,xicom,points));
            f2 = shft2_ret.a;
            f1 = shft2_ret.b;  
        }
        if (step >= ITMAX) {
            throw "golden: iterations maxed out";
        }
        step++;
    }

    if(f1<f2) {
        xmin=x1;
        fret=f1;
        return {xmin:xmin, fret:fret};
    } else {
        xmin=x2;
        fret=f2;
        return {xmin:xmin, fret:fret};
    }
}

function shft2 (a,b,c) 
{
    a=b;
    b=c;
    return {a:a, b:b};
}

/*
//in mnbrak
function shft3 (a1,b1,c1,d1) 
{
    a=b1;
    b=c1;
    c=d1;
    return {a:a,b:b,c:c};
}
*/

