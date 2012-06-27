//TODO: 

function powell(p,xi,ftol,ncom,pcom,xicom,points)
{
    var ITMAX=200;
    var TINY=1.0*Math.pow(2.7,-25);
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
 
    for(iter=0;;++iter){ 
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
        if(iter==ITMAX) {
            console.log("ERROR in powell.js: iteration maxed out");
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
}
