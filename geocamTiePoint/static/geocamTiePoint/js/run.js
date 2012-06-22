/* global variables go here:*/
var ncom, pcom, xicom, numTiePts;

var xp1 = 104.8626; var yp1 = 73.3830; var x1 = 190.6316; var y1=105.1053;
var xp2 = 328.9327; var yp2 = 192.6462; var x2 = 303.7895; var y2=249.8421;
var xp3 = 372.3012; var yp3 = 33.6287; var x3 = 391.9474; var y3=189.3158;

var points = new Array ();
points[0] = new Array (xp1,yp1,x1,y1);
points[1] = new Array (xp2,yp2,x2,y2);
points[2] = new Array (xp3,yp3,x3,y3);
numTiePts = points.length;

var x1 = new Array(); //to_pts (target pts)
var y1 = new Array(); //to_pts (target pts)
var x2 = new Array(); //from_pts 
var y2 = new Array(); //from_pts

for (var i =0; i<points.length; i++) {
    x1[i] = points[i][0];
    y1[i] = points[i][1];
    x2[i] = points[i][2];
    y2[i] = points[i][3];
}

var ncom; var pcom; var xicom;

run(points);


function run(points)
{
    var align_images_ret = align_images();    
    
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
    powell_ret = powell(p,xiM,ftol);
    
    finalpts = powell_ret.finalpts;
    console.log("finalpts: "+finalpts);
    iter = powell_ret.iter;
    fret = powell_ret.fret;
    xi = powell_ret.xi;
}

