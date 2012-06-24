function mnbrak(ax,bx,ncom,pcom,xicom,points) 
{
    var GOLD=1.618034;
    var GLIMIT=100.0;
    var TINY=Math.pow(2.06115362*10,-9);
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
