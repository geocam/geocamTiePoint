// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

/* f1dim: Breaks down the multidimensional function to one-d function
 * for golden to handle. */

function f1dim(x,ncom,pcom,xicom,points) 
{
    var xt=new Array(ncom);
    for (var i=0; i<ncom; i++) {
        xt[i] = pcom[i]+x*xicom[i];
    }
    return func(xt,ncom,pcom,xicom,points);
}

/* func: The function we are trying to optimize. FIX: This should be passed into
 * the optimization procedure as a parameter. */
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

/* Performs one-dimensional Golden Section Search. Referenced
 * pseudo-code in Numerical Recipes. */
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

/* linmin: Basically a wrapper to extend one-dimensional optimization function
 * to multi-dimensional optimization. Need to call golden section search
 * from linmin in order for it to be used by powell, which performs
 * multi-dimensional optimization. */
function linmin(p,xi,ncom,pcom,xicom,points)
{
    var TOL = Math.exp(-8);
    var n = p.length;
    ncom = n;
    pcom = p;
    xicom = xi;
    var numTiePts = points.length;

    var ax = 0.0;
    var xx = 1.0;
    var fret = 0;
    
    var mnbrak_ret=mnbrak(ax,xx,ncom,pcom,xicom,points);
    
    ax = mnbrak_ret.ax;
    xx = mnbrak_ret.bx;
    var bx = mnbrak_ret.cx;

    var golden_ret=golden(ax,xx,bx,TOL,ncom,pcom,xicom,points);
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

/* mnbrak: Given two initial points, finds three points that brackets the minimum. 
 * The bracket points are passed to golden section search. */
function mnbrak(ax,bx,ncom,pcom,xicom,points) 
{
    var GOLD=1.618034;
    var GLIMIT=100.0;
    var TINY=1e-20;
    var ITMAX = 100;
    var fa = f1dim(ax,ncom,pcom,xicom,points);
    var fb = f1dim(bx,ncom,pcom,xicom,points);
    var shft3_ret;

    if (fb>fa) {
        var temp = ax;
        ax = bx;//SWAP(ax,bx).i;
        bx = temp;//SWAP(ax,bx).j;

        temp=fb;
        fb = fa;//SWAP(fb,fa).i;
        fa = temp;//SWAP(fb,fa).j;
    }

    var cx=bx+GOLD*(bx-ax);
    var fc=f1dim(cx,ncom,pcom,xicom,points);

    var step = 0;

    while (fb>fc) {
        
        var r=(bx-ax)*(fb-fc);
        var q=(bx-cx)*(fb-fa);
        var u=bx-((bx-cx)*q-(bx-ax)*r)/(2.0*SIGN(Math.max(Math.abs(q-r),TINY),q-r));
        var ulim=bx+GLIMIT*(cx-bx);
        if ((bx-u)*(u-cx) > 0.0) {
            var fu=f1dim(u,ncom,pcom,xicom,points);
            if(fu<fc) {
                ax=bx;
                bx=u;
                fa=fb;
                fb=fu; 
                return {ax:ax,bx:bx,cx:cx};
            } else if (fu>fb) {
                cx =u;
                fc=fu;
                return {ax:ax,bx:bx,cx:cx};
            }
            u=cx+GOLD*(cx-bx);
            fu=f1dim(u,ncom,pcom,xicom,points);
        } else if ((cx-u)*(u-ulim) > 0.0) {
            fu=f1dim(u,ncom,pcom,xicom,points);
            if (fu<fc) {
                shft3_ret = shft3(bx,cx,u,cx+GOLD*(cx-bx));
                bx = shft3_ret.a;
                cx = shft3_ret.b;
                u  = shft3_ret.c;

                shft3_ret = shft3(fb,fc,fu,f1dim(u,ncom,pcom,xicom,points));
                fb = shft3_ret.a;
                fc = shft3_ret.b;
                fu = shft3_ret.c;
            }
        } else if ((u-ulim)*(ulim-cx) >= 0.0){
            u=ulim;
            fu=f1dim(u,ncom,pcom,xicom,points);
        } else {
            u=cx+GOLD*(cx-bx);
            fu=f1dim(u,ncom,pcom,xicom,points);
        }
        shft3_ret = shft3(ax,bx,cx,u);
        ax = shft3_ret.a;
        bx = shft3_ret.b;
        cx = shft3_ret.c;

        fa = shft3_ret.fa;
        fb = shft3_ret.fb;
        fc = shft3_ret.fc;

        if (step >= ITMAX) {
            throw "mnbrak iterations maxed out";
        }
        step++;
    }
    return {ax:ax,bx:bx,cx:cx}
}

function shft3 (a1,b1,c1,d1) 
{
    a=b1;
    b=c1;
    c=d1;
    return {a:a,b:b,c:c};
}

function SWAP(i1,j1) 
{
    return {i:j1,j:i1}
}

function SIGN(a,b) 
{
    if (b>0.0) {
        return Math.abs(a);
    } else {
        return -1*Math.abs(a);
    }
}

/* Uses Powell's Method to find a local minimum of a function. No derivatives are 
 * needed to find the minimum. */
function powell(p,xi,ftol,ncom,pcom,xicom,points)
{
    var ITMAX=200;
    var TINY=1e-25;
    var n=p.length;
    var iter;
    var linmin_ret;
    var fptt;
    var fp;
    var ibig;
    var del;
    var t;
    var pt = new Array(n);
    var ptt = new Array(n);
    var xit = new Array(n);
    var fret=func(p,ncom,pcom,xicom,points);
  
    for (var j=0;j<n;j++){
        pt[j]=p[j];
    }
 
    for(iter=0; iter < ITMAX; ++iter){ 
        fp=fret;
        ibig=0; 
        del=0.0; 
        
        for (var i=0; i<n; i++) {
            for (var j=0; j<n; j++) {
                xit[j]=xi.values[j][i];
            }
            fptt=fret;
            linmin_ret=linmin(p,xit,ncom,pcom,xicom,points);
            p = linmin_ret.p;
            xit = linmin_ret.xi;
            fret = linmin_ret.fret;

            if ((fptt-fret) > del) {
                del=fptt-fret;
                ibig=i+1;
            }
        }

        if ((2.0*(fp-fret)) <= (ftol*(Math.abs(fp)+Math.abs(fret))+TINY)){
            return {finalpts:p,iter:iter,fret:fret,xi:xi};
        }

        for (var i=0; i<n; i++) {
            ptt[i] = 2.0*p[i]-pt[i];
            xit[i] = p[i]-pt[i];
            pt[i] = p[i];
        }

        
        fptt=func(ptt,ncom,pcom,xicom,points);
        
        if(fptt < fp) {
        
            t=2.0*(fp-2.0*fret+fptt)*
                (Math.pow(fp-fret-del,2))-
                del*(Math.pow(fp-fptt,2));
            
            if(t < 0.0) {
                linmin_ret=linmin(p,xit,ncom,pcom,xicom,points); 
                p = linmin_ret.p;
                xit = linmin_ret.xi;
                fret = linmin_ret.fret;
                for (var j=0; j<n; j++) {
                    xi.values[j][ibig-1]=xi.values[j][n-1];
                    xi.values[j][n-1]=xit[j];
                }
            }
        }
   } 
    throw "ERROR in powell.js: iteration maxed out";
}

var ncom; var pcom; var xicom;

/* generateMatrix: An application-specific wrapper function that drives the optimizer for
   tie-point alignment. FIX: move this elsewhere */
function generateMatrix(points, numTiePts)
{
    var x1 = new Array(); //to_pts (target pts)
    var y1 = new Array(); //to_pts (target pts)
    var x2 = new Array(); //from_pts 
    var y2  = new Array(); //from_pts
 
    for (var i =0; i<points.length; i++) {
        x1[i] = points[i][0];
        y1[i] = points[i][1];
        x2[i] = points[i][2];
        y2[i] = points[i][3];
    }

    var numTiePts = points.length;
    var ncom, pcom, xicom;
    var align_images_ret = align_images(points);    
    console.log('points: ' + JSON.stringify(points));
    //test_align_error2('generateMatrix', points);
    
    //to access return values, do, align_images_ret.xscale
    console.log('align_images_ret: ' + JSON.stringify(align_images_ret));
    var xscale = align_images_ret.xscale;
    var yscale = align_images_ret.yscale;
    var tx = align_images_ret.tx;
    var ty = align_images_ret.ty;

    

    var theta = 0;
    var ftol = 0.001;

    // see func.js for implementation of these transforms
    console.log('numTiePts: ' + numTiePts);
    if (numTiePts >= 4) {
        // set up affine part
        var a = [Math.cos(theta) * xscale, -Math.sin(theta) * yscale, tx,
                 Math.sin(theta) * xscale, Math.cos(theta) * yscale, ty];

        var USE_QUADRATIC = true;
        if (USE_QUADRATIC && (numTiePts >= 7)) {
            // 12-parameter quadratic
            p = [0, 0, a[0], a[1], a[2],
                 0, 0, a[3], a[4], a[5],
                 0, 0];
        } else if (numTiePts >= 5) {
            // 8-parameter projective
            p = a.concat([0, 0]);
        } else {
            // 6-parameter affine
            p = a;
        }              

    } else if (numTiePts >= 3) {
        // 5-parameter: scale, translation, rotation
        p = [xscale,yscale,theta,tx,ty];
    } else if (numTiePts >= 2) {
        // 4-parameter: scale, translation
        p = [xscale,yscale,tx,ty];
    } else {
        throw "ERROR: generateMatrix: not enough tie points!";
    }    
   
    //matrix of unit vectors   
    var xi= new Array(p.length);
    for (var i=0; i<p.length; i++) {
        xi[i]= new Array(p.length);
        for (var j=0; j<p.length; j++) {
            if(i==j) {
                xi[i][j]=1;
            } else {
                xi[i][j]=0;
            }   
        } 
    }
    var xiM = new Matrix(p.length,p.length,xi);

    ncom=0;pcom=[];xicom=[];  
    powell_ret = powell(p,xiM,ftol,ncom,pcom,xicom,points);
    
    finalpts = powell_ret.finalpts;
    iter = powell_ret.iter;
    fret = powell_ret.fret;
    xi = powell_ret.xi;
    return getTransform(powell_ret.finalpts);
}
