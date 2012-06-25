/* global variables go here:*/

var xp1 = 104.8626; var yp1 = 73.3830; var x1 = 190.6316; var y1=105.1053;
var xp2 = 328.9327; var yp2 = 192.6462; var x2 = 303.7895; var y2=249.8421;
var xp3 = 372.3012; var yp3 = 33.6287; var x3 = 391.9474; var y3=189.3158;

var points = new Array ();
points[0] = new Array (xp1,yp1,x1,y1);
points[1] = new Array (xp2,yp2,x2,y2);
points[2] = new Array (xp3,yp3,x3,y3);


var transformMatrix = run(points);

function run(points)
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
    
    //to access return values, do, align_images_ret.xscale
    var xscale = align_images_ret.xscale;
    var yscale = align_images_ret.yscale;
    var tx = align_images_ret.tx;
    var ty = align_images_ret.ty;

    var theta = 0;
    var ftol = 0.001;
    if (numTiePts ==2) {
        p=[xscale,yscale,tx,ty];
    } else if (numTiePts ==3) {
        p=[xscale,yscale,theta,tx,ty];
    } else if (numTiePts ==4) {
        p=[xscale*cos(theta),-sin(theta),
         sin(theta),yscale*cos(theta),tx,ty];
    } else if (numTiePts >=4) {
        p=[xscale*cos(theta),-sin(theta),tx,
          sin(theta),yscale*cos(theta),ty,0,0,1];
    } else {
        console.log("ERROR: wrong number of tie points!");
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
    return putIntoMatrix(finalpts,numTiePts);
}

function putIntoMatrix(p,numTiePts)
{
    var tMtx;
    if (numTiePts ==2) {
        xscale=p[0];
        yscale=p[1];
        tx=p[2];
        ty=p[3];
        tvals=[[xscale,0,tx],
              [0,yscale,ty],
              [0,0,1]];
    } else if (numTiePts==3) {
        xscale=p[0];
        yscale=p[1];
        theta=p[2];
        tx=p[3];
        ty=p[4];
        tvals = [[xscale*Math.cos(theta), -Math.sin(theta), tx],
                [Math.sin(theta), yscale*Math.cos(theta), ty],
                [0, 0, 1]];
    } else if (numTiePts==4) {
        var a11=p[0];
        var a12=p[1];
        var a21=p[2];
        var a22=p[3];
        tx=p[4];
        ty=p[5];
        tvals = [[a11, a12, tx], 
                [a21, a22, ty], 
                [0,0,1]];
    } else if (numTiePts>4) {
        var p11=p[0];
        var p12=p[1];
        var p13=p[2];
        var p21=p[3];
        var p22=p[4];
        var p23=p[5];
        var p31=p[6];
        var p32=p[7];
        var p33=p[8];
        tvals =[[p11,p12,p13],
               [p21,p22,p23],
               [p31,p32,p33]];
    } else {
        console.log("error in func: wrong number of parameters to tMtx!");
    }    
    tMtx = new Matrix(3,3,tvals);
    return tMtx; 
}

