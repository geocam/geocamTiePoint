function align_images()
{
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

    var tx = c1x-c2x;
    var ty = c1y-c2y; 
    return {xscale:xscale,yscale:yscale,theta:0,tx:tx,ty:ty};
}

Array.prototype.sum = function() 
{
  return this.reduce(function(a,b){return a+b;});
}


