function align_images(points)
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
    //find centroid of polygon made of pts.
    c1x=x1.sum()/points.length;
    c1y=y1.sum()/points.length;
    c2x=x2.sum()/points.length;    
    c2y=y2.sum()/points.length;       
    
    var to_y = 0;
    var to_x = 0;
    var from_y= 0;
    var from_x= 0;
    for (var i=0; i<points.length; i++) {
        to_y+=Math.abs(y1[i]-c1y);
        to_x+=Math.abs(x1[i]-c1x);       
        from_y+=Math.abs(y2[i]-c2y);        
        from_x+=Math.abs(x2[i]-c2x);        
    }

    //find the mean length from centroid to point.
    var len = points.length;
    var yscale = (to_y/points.length)/(from_y/points.length);
    var xscale = (to_x/points.length)/(from_x/points.length);

    var tx = c1x - c2x * xscale;
    var ty = c1y - c2y * yscale;
    return {xscale:xscale,yscale:yscale,theta:0,tx:tx,ty:ty};
}

Array.prototype.sum = function() 
{
  return this.reduce(function(a,b){return a+b;});
};

function test_align_error(name, a, b) {
    var err = Math.max(Math.abs(a.xscale - b.xscale),
                       Math.abs(a.yscale - b.yscale),
                       Math.abs(a.tx - b.tx),
                       Math.abs(a.ty - b.ty));
    if (err > 0.001) {
        console.log('ERROR case "' + name + '": values do not match');
        console.log(a)
        console.log(b);
    } else {
        console.log('OK case "' + name + '"');
    }
    return err;
}

function test_align_images() {
    var case1 = [[1, 1, 0, 0],
                 [3, 5, 1, 1]];
    var correct1 = {xscale: 2, yscale: 4, tx: 1, ty: 1};
    test_align_error('1', correct1, align_images(case1));
}
