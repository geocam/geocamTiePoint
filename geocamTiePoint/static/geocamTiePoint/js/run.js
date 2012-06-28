var ncom; var pcom; var xicom;

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

        var USE_QUADRATIC = false;
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

