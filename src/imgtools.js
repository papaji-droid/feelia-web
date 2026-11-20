/* FREE.A: công cụ xử lý ảnh nâng cao, chỉ tải trong trang quản trị.
   1. Xóa watermark theo mẫu nhà sỉ. Watermark là thứ duy nhất giống hệt nhau trên mọi ảnh của một nhà sỉ, nên
      so nhiều ảnh sẽ tính được CHÍNH XÁC từng điểm ảnh của watermark: độ đục alpha và màu. Ảnh có watermark là
      ảnh = alpha*màu + (1-alpha)*gốc, nên tính ngược lại được đúng điểm ảnh gốc bên dưới (khôi phục, không đoán).
      Chỉ những điểm watermark gần như đặc (không còn thông tin gốc) mới phải vẽ lại bằng vá mảng (PatchMatch).
   2. Xóa vùng tô tay: tự dò đúng nét chữ trong vùng tô, rồi khôi phục như trên. Không xóa cả vùng.
   3. Cắt khung 4:5 giữ trọn người mẫu: nhận diện người (MediaPipe), luôn giữ đầu, thiếu chỗ thì nới nền hai bên.
   Mọi xử lý chạy trên máy người dùng, ảnh không gửi đi đâu. */
(()=>{
"use strict";
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const tick=()=>new Promise(r=>setTimeout(r,0));
const cnv=(w,h)=>{const c=document.createElement("canvas");c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c};
const g2d=c=>c.getContext("2d",{willReadFrequently:true});
let SEED=12345;const rnd=()=>(SEED=(SEED*1103515245+12345)>>>0)/4294967296;

/* ---------- đọc, ghi điểm ảnh ---------- */
function readRGB(c,x,y,w,h){
  const d=g2d(c).getImageData(x,y,w,h).data,n=w*h,o=new Float32Array(n*3);
  for(let i=0,j=0;i<n;i++,j+=4){o[i*3]=d[j];o[i*3+1]=d[j+1];o[i*3+2]=d[j+2]}
  return o;
}
function readRGB8(c,x,y,w,h){
  const d=g2d(c).getImageData(x,y,w,h).data,n=w*h,o=new Uint8Array(n*3);
  for(let i=0,j=0;i<n;i++,j+=4){o[i*3]=d[j];o[i*3+1]=d[j+1];o[i*3+2]=d[j+2]}
  return o;
}
function writeRGB(c,F,x,y,w,h,M){
  const g=g2d(c),im=g.getImageData(x,y,w,h),d=im.data,n=w*h;
  for(let i=0,j=0;i<n;i++,j+=4){if(M&&!M[i])continue;d[j]=F[i*3];d[j+1]=F[i*3+1];d[j+2]=F[i*3+2];d[j+3]=255}
  g.putImageData(im,x,y);
}
async function decode(file){
  try{return await createImageBitmap(file)}catch(e){}
  const u=URL.createObjectURL(file);
  try{const i=new Image();i.decoding="async";await new Promise((ok,no)=>{i.onload=ok;i.onerror=()=>no({code:"load"});i.src=u});return i}
  finally{setTimeout(()=>URL.revokeObjectURL(u),3000)}
}
const dims=b=>[b.naturalWidth||b.width,b.naturalHeight||b.height];
const shut=b=>{if(b&&b.close)b.close()};
/* vẽ ảnh vào khung w×h (kéo giãn đúng tỉ lệ khi cùng khổ) */
function drawTo(b,w,h){const c=cnv(w,h),x=g2d(c);x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(b,0,0,w,h);return c}

/* ---------- lọc mờ Gauss (3 lượt lọc hộp) ---------- */
function boxSizes(s){const n=3,wi=Math.sqrt(12*s*s/n+1);let wl=Math.floor(wi);if(wl%2===0)wl--;const wu=wl+2,m=Math.round((12*s*s-n*wl*wl-4*n*wl-3*n)/(-4*wl-4));const o=[];for(let i=0;i<n;i++)o.push(i<m?wl:wu);return o}
function boxH(a,b,w,h,C,r){const n=2*r+1;
  for(let y=0;y<h;y++){const row=y*w;for(let c=0;c<C;c++){let s=0;
    for(let k=-r;k<=r;k++)s+=a[(row+clamp(k,0,w-1))*C+c];
    for(let x=0;x<w;x++){b[(row+x)*C+c]=s/n;s+=a[(row+(x+r+1<w?x+r+1:w-1))*C+c]-a[(row+(x-r>0?x-r:0))*C+c]}}}}
function boxV(a,b,w,h,C,r){const n=2*r+1;
  for(let x=0;x<w;x++)for(let c=0;c<C;c++){let s=0;
    for(let k=-r;k<=r;k++)s+=a[(clamp(k,0,h-1)*w+x)*C+c];
    for(let y=0;y<h;y++){b[(y*w+x)*C+c]=s/n;s+=a[((y+r+1<h?y+r+1:h-1)*w+x)*C+c]-a[((y-r>0?y-r:0)*w+x)*C+c]}}}
function blur(src,w,h,C,s){
  const a=Float32Array.from(src);if(s<.35)return a;const b=new Float32Array(a.length);
  for(const bs of boxSizes(s)){const r=(bs-1)>>1;if(r<1)continue;boxH(a,b,w,h,C,r);boxV(b,a,w,h,C,r)}
  return a;
}

/* ---------- khoảng cách Euclid tới điểm gần nhất (Felzenszwalb), giãn, co ---------- */
function edt1(f,n,d,v,z){
  let k=0;v[0]=0;z[0]=-1e30;z[1]=1e30;
  for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
    while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k])}
    k++;v[k]=q;z[k]=s;z[k+1]=1e30}
  k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])*(q-v[k])+f[v[k]]}
}
function edt(M,w,h){
  const N=w*h,D=new Float32Array(N),L=Math.max(w,h),f=new Float64Array(L),d=new Float64Array(L),v=new Int32Array(L),z=new Float64Array(L+1);
  for(let i=0;i<N;i++)D[i]=M[i]?0:1e20;
  for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=D[y*w+x];edt1(f,h,d,v,z);for(let y=0;y<h;y++)D[y*w+x]=d[y]}
  for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++)f[x]=D[o+x];edt1(f,w,d,v,z);for(let x=0;x<w;x++)D[o+x]=d[x]}
  return D;
}
function dilate(M,w,h,r){if(r<=0)return Uint8Array.from(M);const D=edt(M,w,h),o=new Uint8Array(w*h),r2=r*r+1e-6;for(let i=0;i<o.length;i++)o[i]=D[i]<=r2?1:0;return o}
function erode(M,w,h,r){const inv=new Uint8Array(w*h);for(let i=0;i<inv.length;i++)inv[i]=M[i]?0:1;const d=dilate(inv,w,h,r);for(let i=0;i<d.length;i++)d[i]=d[i]?0:1;return d}

/* ---------- vùng liền (8 hướng), ngưỡng trễ ---------- */
function comps(M,w,h){
  const N=w*h,lab=new Int32Array(N),st=new Int32Array(N),out=[];let n=0;
  for(let i=0;i<N;i++){if(!M[i]||lab[i])continue;n++;let sp=0,cnt=0,x0=w,y0=h,x1=-1,y1=-1;st[sp++]=i;lab[i]=n;
    while(sp){const j=st[--sp],x=j%w,y=(j-x)/w;cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const k=yy*w+xx;if(M[k]&&!lab[k]){lab[k]=n;st[sp++]=k}}}}
    out.push({id:n,n:cnt,x0,y0,x1,y1})}
  return{lab,out};
}
function dropSmall(M,w,h,minN){const{lab,out}=comps(M,w,h),bad=new Uint8Array(out.length+1);let any=false;for(const c of out)if(c.n<minN){bad[c.id]=1;any=true}
  if(any)for(let i=0;i<M.length;i++)if(M[i]&&bad[lab[i]])M[i]=0;return M}
function hysteresis(V,w,h,lo,hi){
  const N=w*h,M=new Uint8Array(N),st=new Int32Array(N);
  for(let i=0;i<N;i++){if(V[i]<hi||M[i])continue;let sp=0;M[i]=1;st[sp++]=i;
    while(sp){const j=st[--sp],x=j%w,y=(j-x)/w;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const k=yy*w+xx;if(!M[k]&&V[k]>=lo){M[k]=1;st[sp++]=k}}}}}
  return M;
}

/* ---------- trung vị ---------- */
function qsel(a,n,k){let l=0,r=n-1;
  while(r>l){const p=a[(l+r)>>1];let i=l,j=r;while(i<=j){while(a[i]<p)i++;while(a[j]>p)j--;if(i<=j){const t=a[i];a[i]=a[j];a[j]=t;i++;j--}}if(k<=j)r=j;else if(k>=i)l=i;else break}
  return a[k]}
function sampleMedian(V,q){const n=V.length,st=Math.max(1,Math.floor(n/40000)),t=[];for(let i=0;i<n;i+=st)t.push(V[i]);t.sort((a,b)=>a-b);return t[Math.min(t.length-1,Math.floor(t.length*(q==null?.5:q)))]||0}

/* ---------- điền màng mịn (phương trình Laplace) vào chỗ M=1, đa lưới từ thô đến mịn ---------- */
function sor(V,w,h,C,K,it){
  const U=[[],[]];for(let i=0;i<w*h;i++)if(!K[i]){const x=i%w,y=(i-x)/w;U[(x+y)&1].push(i)}
  const A=[Int32Array.from(U[0]),Int32Array.from(U[1])];if(!A[0].length&&!A[1].length)return;const om=1.82;
  for(let t=0;t<it;t++)for(const L of A)for(let q=0;q<L.length;q++){const i=L[q],x=i%w;
    let n=0,s0=0,s1=0,s2=0;
    if(x>0){const j=(i-1)*C;n++;s0+=V[j];if(C>1){s1+=V[j+1];s2+=V[j+2]}}
    if(x<w-1){const j=(i+1)*C;n++;s0+=V[j];if(C>1){s1+=V[j+1];s2+=V[j+2]}}
    if(i>=w){const j=(i-w)*C;n++;s0+=V[j];if(C>1){s1+=V[j+1];s2+=V[j+2]}}
    if(i<w*(h-1)){const j=(i+w)*C;n++;s0+=V[j];if(C>1){s1+=V[j+1];s2+=V[j+2]}}
    const j=i*C;V[j]+=om*(s0/n-V[j]);if(C>1){V[j+1]+=om*(s1/n-V[j+1]);V[j+2]+=om*(s2/n-V[j+2])}}
}
function harmonicFill(F,w,h,C,M,fine){
  let unk=0;for(let i=0;i<w*h;i++)if(M[i])unk++;if(!unk)return F;
  const K0=new Uint8Array(w*h);for(let i=0;i<K0.length;i++)K0[i]=M[i]?0:1;
  const L=[{w,h,V:F,K:K0}];
  for(;;){const P=L[L.length-1];let miss=false;for(let i=0;i<P.K.length;i++)if(!P.K[i]){miss=true;break}
    if(!miss||(P.w<=2&&P.h<=2))break;
    const w2=(P.w+1)>>1,h2=(P.h+1)>>1,V2=new Float32Array(w2*h2*C),K2=new Uint8Array(w2*h2);
    for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){let n=0;const i2=y*w2+x;
      for(let dy=0;dy<2;dy++){const yy=2*y+dy;if(yy>=P.h)continue;for(let dx=0;dx<2;dx++){const xx=2*x+dx;if(xx>=P.w)continue;const j=yy*P.w+xx;if(!P.K[j])continue;n++;for(let c=0;c<C;c++)V2[i2*C+c]+=P.V[j*C+c]}}
      if(n){K2[i2]=1;for(let c=0;c<C;c++)V2[i2*C+c]/=n}}
    L.push({w:w2,h:h2,V:V2,K:K2})}
  const T=L[L.length-1];{let n=0;const m=new Float64Array(C);for(let i=0;i<T.K.length;i++)if(T.K[i]){n++;for(let c=0;c<C;c++)m[c]+=T.V[i*C+c]}
    for(let i=0;i<T.K.length;i++)if(!T.K[i])for(let c=0;c<C;c++)T.V[i*C+c]=n?m[c]/n:0}
  for(let l=L.length-1;l>=0;l--){const P=L[l];
    if(l<L.length-1){const Q=L[l+1];
      for(let y=0;y<P.h;y++){const fy=clamp((y+.5)/2-.5,0,Q.h-1),y0=Math.floor(fy),y1=Math.min(Q.h-1,y0+1),ty=fy-y0;
        for(let x=0;x<P.w;x++){const i=y*P.w+x;if(P.K[i])continue;const fx=clamp((x+.5)/2-.5,0,Q.w-1),x0=Math.floor(fx),x1=Math.min(Q.w-1,x0+1),tx=fx-x0;
          for(let c=0;c<C;c++){const a=Q.V[(y0*Q.w+x0)*C+c],b=Q.V[(y0*Q.w+x1)*C+c],d=Q.V[(y1*Q.w+x0)*C+c],e=Q.V[(y1*Q.w+x1)*C+c];
            P.V[i*C+c]=(a*(1-tx)+b*tx)*(1-ty)+(d*(1-tx)+e*tx)*ty}}}}
    sor(P.V,P.w,P.h,C,P.K,l?10:(fine||30))}
  return F;
}

/* ---------- vá mảng (PatchMatch nhiều tầng, kiểu Content-Aware Fill) ----------
   Điền chỗ M=1 bằng các mảng 7×7 lấy từ phần ảnh còn lại gần đó, bỏ phiếu có trọng số. */
const PR=3;
function complete(D,w,h,M,o){
  o=o||{};let x0=w,y0=h,x1=-1,y1=-1,nh=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(M[y*w+x]){nh++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(!nh)return D;
  /* độ dày lớn nhất của chỗ trống quyết định lấy mảng nguồn xa đến đâu */
  const inv=new Uint8Array(w*h);for(let i=0;i<inv.length;i++)inv[i]=M[i]?0:1;
  const Dh=edt(inv,w,h);let th=0;for(let i=0;i<Dh.length;i++)if(M[i]&&Dh[i]>th)th=Dh[i];th=Math.sqrt(th);
  const mg=Math.round(clamp(8*th+14,18,o.maxMargin||200));
  const rx0=Math.max(0,x0-mg),ry0=Math.max(0,y0-mg),rx1=Math.min(w-1,x1+mg),ry1=Math.min(h-1,y1+mg),rw=rx1-rx0+1,rh=ry1-ry0+1;
  let I=new Float32Array(rw*rh*3),H=new Uint8Array(rw*rh);
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x,j=(ry0+y)*w+rx0+x;H[i]=M[j];I[i*3]=D[j*3];I[i*3+1]=D[j*3+1];I[i*3+2]=D[j*3+2]}
  harmonicFill(I,rw,rh,3,H,40);
  /* tháp ảnh */
  const lv=[{w:rw,h:rh,I,H,t:th}];
  while(lv.length<6){const P=lv[lv.length-1];if(P.t<=2.5||Math.min(P.w,P.h)<6*PR+6)break;
    const w2=(P.w+1)>>1,h2=(P.h+1)>>1,I2=new Float32Array(w2*h2*3),H2=new Uint8Array(w2*h2);
    for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){let n=0;const k=y*w2+x;
      for(let dy=0;dy<2;dy++){const yy=2*y+dy;if(yy>=P.h)continue;for(let dx=0;dx<2;dx++){const xx=2*x+dx;if(xx>=P.w)continue;const j=yy*P.w+xx;n++;if(P.H[j])H2[k]=1;I2[k*3]+=P.I[j*3];I2[k*3+1]+=P.I[j*3+1];I2[k*3+2]+=P.I[j*3+2]}}
      I2[k*3]/=n;I2[k*3+1]/=n;I2[k*3+2]/=n}
    lv.push({w:w2,h:h2,I:I2,H:H2,t:P.t/2})}
  let prev=null;
  for(let l=lv.length-1;l>=0;l--){const P=lv[l];
    if(prev){/* đưa kết quả tầng thô lên tầng mịn */
      const Q=prev;for(let y=0;y<P.h;y++){const fy=clamp((y+.5)/2-.5,0,Q.h-1),ya=Math.floor(fy),yb=Math.min(Q.h-1,ya+1),ty=fy-ya;
        for(let x=0;x<P.w;x++){const i=y*P.w+x;if(!P.H[i])continue;const fx=clamp((x+.5)/2-.5,0,Q.w-1),xa=Math.floor(fx),xb=Math.min(Q.w-1,xa+1),tx=fx-xa;
          for(let c=0;c<3;c++){const a=Q.I[(ya*Q.w+xa)*3+c],b=Q.I[(ya*Q.w+xb)*3+c],d=Q.I[(yb*Q.w+xa)*3+c],e=Q.I[(yb*Q.w+xb)*3+c];P.I[i*3+c]=(a*(1-tx)+b*tx)*(1-ty)+(d*(1-tx)+e*tx)*ty}}}}
    P.nnf=pmLevel(P,prev,l===lv.length-1?7:l?4:3);prev=P}
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(!H[i])continue;const j=(ry0+y)*w+rx0+x;D[j*3]=lv[0].I[i*3];D[j*3+1]=lv[0].I[i*3+1];D[j*3+2]=lv[0].I[i*3+2]}
  return D;
}
/* một tầng: lặp tìm mảng giống nhất (PatchMatch) rồi bỏ phiếu */
function pmLevel(P,Q,iters){
  const w=P.w,h=P.h,I=P.I,H=P.H,R=PR,N=w*h;
  const near=dilate(H,w,h,R+.5);  /* tâm mảng chạm chỗ trống */
  const okS=new Uint8Array(N),src=[];
  for(let y=R;y<h-R;y++)for(let x=R;x<w-R;x++){const i=y*w+x;if(!near[i]){okS[i]=1;src.push(i)}}
  if(!src.length){return null}
  const T=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(near[i])T.push(i)}
  const nnf=new Int32Array(N).fill(-1),dist=new Float32Array(N).fill(1e30);
  const pick=()=>src[Math.floor(rnd()*src.length)];
  /* khởi tạo: từ tầng thô nếu có, không thì ngẫu nhiên */
  for(const t of T){let s=-1;
    if(Q&&Q.nnf){const x=t%w,y=(t-x)/w,qx=Math.min(Q.w-1,x>>1),qy=Math.min(Q.h-1,y>>1),qs=Q.nnf[qy*Q.w+qx];
      if(qs>=0){const sx=(qs%Q.w)*2+(x&1),sy=((qs/Q.w)|0)*2+(y&1),k=sy*w+sx;if(sx<w&&sy<h&&okS[k])s=k}}
    if(s<0)s=pick();nnf[t]=s}
  const pd=(t,s,cut)=>{const tx=t%w,ty=(t-tx)/w,sx=s%w,sy=(s-sx)/w;let d=0;
    for(let dy=-R;dy<=R;dy++){const yt=clamp(ty+dy,0,h-1),ys=sy+dy,ot=yt*w,os=ys*w;
      for(let dx=-R;dx<=R;dx++){const a=(ot+clamp(tx+dx,0,w-1))*3,b=(os+sx+dx)*3;const e0=I[a]-I[b],e1=I[a+1]-I[b+1],e2=I[a+2]-I[b+2];d+=e0*e0+e1*e1+e2*e2}
      if(d>cut)return d}
    return d};
  for(const t of T)dist[t]=pd(t,nnf[t],1e30);
  const maxR=Math.max(w,h);
  const acc=new Float32Array(N*3),wac=new Float32Array(N),ds=new Float32Array(T.length);
  for(let it=0;it<iters;it++){
    for(let pass=0;pass<2;pass++){const fw=pass===0,st=fw?1:-1;
      for(let q=fw?0:T.length-1;fw?q<T.length:q>=0;q+=st){const t=T[q],x=t%w,y=(t-x)/w;let bs=nnf[t],bd=dist[t];
        /* lan truyền từ hàng xóm */
        const nx=x-st;if(nx>=0&&nx<w){const tn=y*w+nx,sn=nnf[tn];if(sn>=0){const c=sn+st;if(c>=0&&c<N&&okS[c]&&c!==bs){const d=pd(t,c,bd);if(d<bd){bd=d;bs=c}}}}
        const ny=y-st;if(ny>=0&&ny<h){const tn=ny*w+x,sn=nnf[tn];if(sn>=0){const c=sn+st*w;if(c>=0&&c<N&&okS[c]&&c!==bs){const d=pd(t,c,bd);if(d<bd){bd=d;bs=c}}}}
        /* tìm ngẫu nhiên quanh mảng tốt nhất, bán kính giảm dần */
        const bx=bs%w,by=(bs-bx)/w;
        for(let r=maxR;r>=1;r>>=1){const cx=bx+Math.round((rnd()*2-1)*r),cy=by+Math.round((rnd()*2-1)*r);if(cx<R||cy<R||cx>=w-R||cy>=h-R)continue;const c=cy*w+cx;if(!okS[c]||c===bs)continue;const d=pd(t,c,bd);if(d<bd){bd=d;bs=c}}
        nnf[t]=bs;dist[t]=bd}}
    /* bỏ phiếu: mỗi điểm trống = trung bình có trọng số của các mảng phủ lên nó */
    for(let q=0;q<T.length;q++)ds[q]=dist[T[q]];
    const sg=Math.max(1,qsel(Float32Array.from(ds),ds.length,Math.floor(ds.length*.75)))/((2*R+1)*(2*R+1)*3);
    acc.fill(0);wac.fill(0);
    for(const t of T){const s=nnf[t],tx=t%w,ty=(t-tx)/w,sx=s%w,sy=(s-sx)/w,wt=Math.exp(-dist[t]/((2*R+1)*(2*R+1)*3)/(2*sg))+1e-6;
      for(let dy=-R;dy<=R;dy++){const yt=ty+dy;if(yt<0||yt>=h)continue;for(let dx=-R;dx<=R;dx++){const xt=tx+dx;if(xt<0||xt>=w)continue;const k=yt*w+xt;if(!H[k])continue;const b=((sy+dy)*w+sx+dx)*3;acc[k*3]+=wt*I[b];acc[k*3+1]+=wt*I[b+1];acc[k*3+2]+=wt*I[b+2];wac[k]+=wt}}}
    for(let k=0;k<N;k++)if(H[k]&&wac[k]>0){I[k*3]=acc[k*3]/wac[k];I[k*3+1]=acc[k*3+1]/wac[k];I[k*3+2]=acc[k*3+2]/wac[k]}
    for(const t of T)dist[t]=pd(t,nnf[t],1e30);
  }
  return nnf;
}

/* ---------- vẽ lại bằng AI: MI-GAN (Picsart AI Research, ICCV 2023, giấy phép MIT), chạy ngay trong trình duyệt ----------
   Chỉ dùng cho phần watermark đặc, nơi không còn thông tin ảnh gốc. Mô hình 28 MB tải một lần, kiểm tra mã băm SHA-256,
   lưu đệm trong trình duyệt. Không tải được (mất mạng, trình duyệt cũ) thì tự dùng vá mảng PatchMatch. */
const ORT_BASE="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/",ORT_SRI="sha384-N94xSNjPDbfBJj4+QINst0nbHpcCm8kc1qNlIP/wA0muqjR3aVyIuDkMeccPrLvQ";
const MIGAN={sha:"6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b",
  src:["https://huggingface.co/andraniksargsyan/migan/resolve/406830d0fa60666da0071c342ad2fbc8f30c5c64/migan_pipeline_v2.onnx","/models/migan_pipeline_v2.onnx"]};
let AIP=null,AIoff=false,AIQ=Promise.resolve();
function loadScript(src,sri,glob){return new Promise((ok,no)=>{if(glob&&window[glob])return ok();const s=document.createElement("script");s.src=src;if(sri){s.integrity=sri;s.crossOrigin="anonymous"}s.onload=()=>ok();s.onerror=()=>no(new Error("script "+src));document.head.appendChild(s)})}
const hexOf=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
async function fetchModel(M){
  let cache=null;try{cache=await caches.open("feelia-models-v1")}catch(e){}
  const key="https://feelia-model.invalid/"+M.sha;
  if(cache){try{const r=await cache.match(key);if(r)return await r.arrayBuffer()}catch(e){}}
  for(const u of M.src){try{const r=await fetch(u);if(!r.ok)continue;const b=await r.arrayBuffer();
      if(window.crypto&&crypto.subtle&&hexOf(await crypto.subtle.digest("SHA-256",b))!==M.sha)continue;
      if(cache)try{await cache.put(key,new Response(b))}catch(e){}
      return b}catch(e){}}
  throw new Error("model");
}
function aiSession(){
  if(AIoff)return Promise.resolve(null);
  return AIP||(AIP=(async()=>{await loadScript(ORT_BASE+"ort.min.js",ORT_SRI,"ort");const ort=window.ort;ort.env.wasm.wasmPaths=ORT_BASE;
    const b=await fetchModel(MIGAN);return await ort.InferenceSession.create(b,{executionProviders:["wasm"],graphOptimizationLevel:"all"})})()
    .catch(e=>{console.warn("FAIMG: AI inpaint unavailable",e);AIP=null;AIoff=true;return null}));
}
/* Điền chỗ M=1 bằng AI, chia thành các khung 512×512 ở đúng độ phân giải gốc. Trả về false nếu AI không dùng được. */
async function aiFill(D,w,h,M){
  const s=await aiSession();if(!s)return false;const ort=window.ort,WS=512,mg=48;
  const{out}=comps(M,w,h);if(!out.length)return true;
  /* gom các mảng gần nhau vào chung khung; mảng quá to thì chia ô */
  const wins=[],lim=WS-2*mg;
  for(const c of out.sort((a,b)=>a.y0-b.y0||a.x0-b.x0)){
    if(c.x1-c.x0+1>lim||c.y1-c.y0+1>lim){for(let y=c.y0;y<=c.y1;y+=lim-32)for(let x=c.x0;x<=c.x1;x+=lim-32)wins.push({x0:x,y0:y,x1:Math.min(c.x1,x+lim-1),y1:Math.min(c.y1,y+lim-1)});continue}
    let put=false;for(const W of wins){const x0=Math.min(W.x0,c.x0),y0=Math.min(W.y0,c.y0),x1=Math.max(W.x1,c.x1),y1=Math.max(W.y1,c.y1);if(x1-x0+1<=lim&&y1-y0+1<=lim){Object.assign(W,{x0,y0,x1,y1});put=true;break}}
    if(!put)wins.push({x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1})}
  const best=new Float32Array(w*h).fill(-1),R=Float32Array.from(D),Mx=dilate(M,w,h,2);
  for(const W of wins){
    const ww=Math.min(WS,w),wh=Math.min(WS,h),wx=clamp(Math.round((W.x0+W.x1+1)/2-ww/2),0,w-ww),wy=clamp(Math.round((W.y0+W.y1+1)/2-wh/2),0,h-wh),n=ww*wh;
    const img=new Uint8Array(3*n),msk=new Uint8Array(n);
    for(let y=0;y<wh;y++)for(let x=0;x<ww;x++){const i=(wy+y)*w+wx+x,k=y*ww+x;for(let c=0;c<3;c++)img[c*n+k]=clamp(Math.round(D[i*3+c]),0,255);msk[k]=Mx[i]?0:255}
    /* mô hình chỉ chạy một lượt một lúc: các ảnh xử lý song song phải xếp hàng */
    const job=AIQ.then(()=>s.run({image:new ort.Tensor("uint8",img,[1,3,wh,ww]),mask:new ort.Tensor("uint8",msk,[1,1,wh,ww])}));AIQ=job.catch(()=>{});
    let o;try{o=(await job).result.data}catch(e){console.warn("FAIMG: AI run failed",e&&e.message||e);return false}
    /* hiệu chỉnh màu ở mép: lệch giữa ảnh thật và ảnh AI trên vành 2 điểm quanh lỗ, nội suy mịn vào trong lỗ */
    const off=new Float32Array(n*3),Hm=new Uint8Array(n);
    for(let y=0;y<wh;y++)for(let x=0;x<ww;x++){const i=(wy+y)*w+wx+x,k=y*ww+x;if(M[i])Hm[k]=1;else if(Mx[i])for(let c=0;c<3;c++)off[k*3+c]=D[i*3+c]-o[c*n+k]}
    harmonicFill(off,ww,wh,3,Hm,30);
    for(let y=0;y<wh;y++)for(let x=0;x<ww;x++){const i=(wy+y)*w+wx+x;if(!M[i])continue;const k=y*ww+x,dd=Math.min(x,y,ww-1-x,wh-1-y);
      if(dd>best[i]){best[i]=dd;for(let c=0;c<3;c++)R[i*3+c]=clamp(o[c*n+k]+off[k*3+c],0,255)}}
    await tick()}
  const left=new Uint8Array(w*h);let nl=0;for(let i=0;i<w*h;i++)if(M[i]&&best[i]<0){left[i]=1;nl++}
  D.set(R);if(nl)complete(D,w,h,left);
  return true;
}
async function fillHole(D,w,h,M,o){if(!(o&&o.ai===false)&&await aiFill(D,w,h,M))return"ai";complete(D,w,h,M,o);return"pm"}

/* ---------- khử watermark khi đã biết alpha và màu ----------
   Điểm alpha thấp đến vừa: tính ngược ra đúng điểm ảnh gốc. Điểm gần như đặc hoặc bị cháy sáng: vá mảng.
   Vùng chuyển tiếp: hòa hai kết quả theo alpha. */
async function unblend(D,w,h,A,Wc,o){
  o=o||{};const aLo=o.aLo==null?.62:o.aLo,aHi=o.aHi==null?.9:o.aHi,N=w*h;
  const R=Float32Array.from(D),U=new Uint8Array(N),tw=new Float32Array(N);let nu=0;
  for(let i=0;i<N;i++){const a=A[i];if(a<=0)continue;
    if(a<.995){const k=1/(1-a);for(let c=0;c<3;c++){const v=(D[i*3+c]-a*Wc[i*3+c])*k;R[i*3+c]=v<0?0:v>255?255:v}}
    let t=a<=aLo?0:a>=aHi?1:(a-aLo)/(aHi-aLo);t=t*t*(3-2*t);
    /* cháy sáng (hoặc tối hẳn) cùng màu watermark: không còn thông tin để tính ngược */
    if(a>.22){let sat=0;for(let c=0;c<3;c++){const wv=Wc[i*3+c],dv=D[i*3+c];if((wv>=235&&dv>=253)||(wv<=20&&dv<=2))sat++}if(sat===3)t=Math.max(t,clamp((a-.22)/.25,0,1))}
    if(t>0){U[i]=1;tw[i]=t;nu++}}
  /* quanh phần watermark đặc: viền khử răng cưa và vệt màu do JPEG nén màu (lem màu) không tính ngược được chính xác,
     nới vùng vá thêm vài điểm để vá luôn viền đó */
  if(nu){const core=new Uint8Array(N);let nc=0;for(let i=0;i<N;i++)if(tw[i]>=.999){core[i]=1;nc++}
    if(nc){const rim=dilate(core,w,h,o.rim==null?2:o.rim);for(let i=0;i<N;i++)if(rim[i]&&A[i]>.02&&tw[i]<1){if(!U[i])nu++;U[i]=1;tw[i]=1}}}
  let how="";
  if(nu){const P=Float32Array.from(R);how=await fillHole(P,w,h,U,o);for(let i=0;i<N;i++)if(U[i]){const t=tw[i];for(let c=0;c<3;c++)R[i*3+c]=(1-t)*R[i*3+c]+t*P[i*3+c]}}
  D.set(R);return{filled:nu,how};
}

/* =================== HỌC MẪU WATERMARK TỪ NHIỀU ẢNH =================== */
/* Phần tần số cao của mỗi ảnh, xét qua các ảnh: watermark (giống hệt nhau) cho trung vị lớn, hoặc lệch nhỏ nhưng
   lần nào cũng lệch cùng chiều (chỉ số t lớn). Nền ảnh mỗi ảnh một khác nên cả hai đều nhỏ. */
function hpStats(imgs,w,h,sigma){
  const K=imgs.length,N=w*h,n=N*3,H=new Int16Array(n*K);
  for(let k=0;k<K;k++){const f=Float32Array.from(imgs[k]),g=blur(f,w,h,3,sigma),o=k*n;for(let i=0;i<n;i++)H[o+i]=Math.round((f[i]-g[i])*8)}
  const Mh=new Float32Array(N),T=new Float32Array(N),t=new Float32Array(K),mid=(K-1)>>1,sq=Math.sqrt(K);
  for(let p=0;p<N;p++){let mm=0,tt=0;
    for(let c=0;c<3;c++){const i=p*3+c;for(let k=0;k<K;k++)t[k]=H[k*n+i];const m=qsel(t,K,mid);for(let k=0;k<K;k++)t[k]=Math.abs(t[k]-m);const d=qsel(t,K,mid);
      const mv=m/8,s=1.4826*d/8/sq*1.25+.35;mm+=mv*mv;tt+=(mv/s)*(mv/s)}
    Mh[p]=Math.sqrt(mm);T[p]=Math.sqrt(tt/3)}
  return{Mh,T:blur(T,w,h,1,.8)};
}
/* bằng chứng có watermark tại từng điểm (>=1 là chắc chắn) */
function evidence(st,N,K){
  const m0=sampleMedian(st.Mh,.5),tM=Math.max(5,9*m0),tT=3.6+8/(K||14),E=new Float32Array(N);
  for(let i=0;i<N;i++)E[i]=Math.max(st.Mh[i]/tM,st.T[i]/tT);
  return E;
}

/* Ước lượng alpha và màu watermark tại từng điểm trong vùng S, từ K ảnh cùng khổ.
   Nền bên dưới mỗi điểm được đoán bằng màng mịn từ các điểm ngoài S; sai số đoán lớn ở nền hoa văn nên các ảnh
   được cân theo độ "dễ đoán", và loại ảnh lệch bằng hồi quy bền (Huber). */
function fitMatte(imgs,w,h,S,opt){
  const K=imgs.length,N=w*h,idx=[];for(let i=0;i<N;i++)if(S[i])idx.push(i);const P=idx.length;
  const out={P,idx,a:new Float32Array(P),se:new Float32Array(P),W:new Float32Array(P*3),Wg:[0,0,0],multi:false,nRel:0};if(!P)return out;
  const notS=new Uint8Array(N);for(let i=0;i<N;i++)notS[i]=S[i]?0:1;const D2=edt(notS,w,h);
  const Iv=new Uint8Array(P*3*K),Bv=new Float32Array(P*3*K),Wv=new Float32Array(P*K);
  const s0=opt.noise||2.2,kap=opt.kap||.6;
  for(let k=0;k<K;k++){const f=Float32Array.from(imgs[k]),B=Float32Array.from(f);harmonicFill(B,w,h,3,S,40);
    /* độ gồ ghề của nền quanh mỗi điểm (bình phương đạo hàm, trung bình 7×7), rồi điền vào S */
    const G=new Float32Array(N);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(S[i])continue;const xa=x>0&&!S[i-1]?i-1:i,xb=x<w-1&&!S[i+1]?i+1:i,ya=y>0&&!S[i-w]?i-w:i,yb=y<h-1&&!S[i+w]?i+w:i;
      let g=0;for(let c=0;c<3;c++){const gx=(f[xb*3+c]-f[xa*3+c])/Math.max(1,xb-xa),gy=(f[yb*3+c]-f[ya*3+c])/Math.max(1,(yb-ya)/w);g+=gx*gx+gy*gy}G[i]=g/3}
    const Gb=blur(G,w,h,1,2.5);for(let i=0;i<N;i++)if(S[i])Gb[i]=0;harmonicFill(Gb,w,h,1,S,20);
    const ib=imgs[k];
    for(let j=0;j<P;j++){const i=idx[j],q=(k*P+j)*3;for(let c=0;c<3;c++){Iv[q+c]=ib[i*3+c];Bv[q+c]=B[i*3+c]}
      Wv[k*P+j]=1/(s0*s0+kap*Gb[i]*D2[i])}
    if(opt.prog&&k%4===3)opt.prog()}
  /* lượt 1: hồi quy 4 ẩn (alpha, alpha*màu RGB) tại từng điểm */
  const Rw=new Float32Array(P*K).fill(1),res=new Float32Array(K),bA=new Float32Array(P),aA=new Float32Array(P*3),seB=new Float32Array(P),Bm=new Float32Array(P*3);
  for(let rep=0;rep<3;rep++){
    for(let j=0;j<P;j++){let Sw=0;const SI=[0,0,0],SB=[0,0,0];let SBI=0,SBB=0;
      for(let k=0;k<K;k++){const wt=Wv[k*P+j]*Rw[k*P+j],q=(k*P+j)*3;Sw+=wt;for(let c=0;c<3;c++){const I=Iv[q+c],B=Bv[q+c];SI[c]+=wt*I;SB[c]+=wt*B;SBI+=wt*B*I;SBB+=wt*B*B}}
      let num=SBI,den=SBB;for(let c=0;c<3;c++){num-=SB[c]*SI[c]/Sw;den-=SB[c]*SB[c]/Sw;Bm[j*3+c]=SB[c]/Sw}
      const b=den>1e-9?num/den:1;bA[j]=b;for(let c=0;c<3;c++)aA[j*3+c]=(SI[c]-b*SB[c])/Sw;
      let ss=0;for(let k=0;k<K;k++){const q=(k*P+j)*3;let r=0;for(let c=0;c<3;c++){const e=Iv[q+c]-aA[j*3+c]-b*Bv[q+c];r+=e*e}res[k]=Math.sqrt(r/3*Wv[k*P+j]);ss+=Wv[k*P+j]*Rw[k*P+j]*r}
      const sc=1.4826*qsel(Float32Array.from(res),K,(K-1)>>1)+1e-3;
      for(let k=0;k<K;k++){const z=res[k]/sc;Rw[k*P+j]=z<=2?1:2/z}
      seB[j]=Math.sqrt(Math.max(ss/Math.max(1,3*K-4),1e-6)/Math.max(den,1e-9))}}
  /* Màu watermark tại từng điểm. Ước lượng thô màu = (alpha*màu)/alpha ở những điểm chắc chắn, rồi làm mịn có giữ
     ranh giới (song phương), vì một watermark có thể nhiều màu: chữ trắng + bóng đen, viền, chữ chuyển màu. */
  /* Sai số của màu ước lượng nằm dọc đường nối màu watermark với màu nền trung bình: se_W ≈ se_b*|W-nền|/alpha. */
  const om=new Float32Array(N),W1=new Float32Array(N*3),seW=new Float32Array(N);let nRel=0;
  for(let j=0;j<P;j++){const al=1-bA[j];if(al>Math.max(.03,2.5*seB[j])){const i=idx[j];nRel++;for(let c=0;c<3;c++)W1[i*3+c]=clamp(aA[j*3+c]/al,-30,285);
    const dW=Math.hypot(W1[i*3]-Bm[j*3],W1[i*3+1]-Bm[j*3+1],W1[i*3+2]-Bm[j*3+2]);seW[i]=seB[j]*dW/al+1.5;om[i]=1/(seW[i]*seW[i])}}
  const Wf=new Float32Array(P*3);let Wg=null,multi=false;
  if(nRel>=20){
    /* màu chính: trung vị có trọng số */
    const rel=[];for(let j=0;j<P;j++)if(om[idx[j]]>0)rel.push(idx[j]);
    const wmed=arr=>{arr.sort((p,q)=>p[0]-q[0]);let tot=0;for(const a of arr)tot+=a[1];let acc=0;for(const a of arr){acc+=a[1];if(acc>=tot/2)return a[0]}return arr.length?arr[arr.length>>1][0]:0};
    Wg=[0,1,2].map(c=>clamp(wmed(rel.map(i=>[W1[i*3+c],om[i]])),0,255));
    /* nhiều màu khi một phần đáng kể mang màu khác màu chính VƯỢT HẲN sai số của nó: bóng đổ, viền, chữ khác màu */
    let tot=0,off=0;for(const i of rel){tot+=om[i];const d=Math.hypot(W1[i*3]-Wg[0],W1[i*3+1]-Wg[1],W1[i*3+2]-Wg[2]);if(d>30&&d>5*seW[i])off+=om[i]}
    multi=opt.multi!=null?!!opt.multi:off>tot*.025;
    if(!multi)for(let j=0;j<P;j++)for(let c=0;c<3;c++)Wf[j*3+c]=Wg[c];
    else{const OW=new Float32Array(N*3);for(let i=0;i<N;i++)for(let c=0;c<3;c++)OW[i*3+c]=om[i]*W1[i*3+c];
      const bO=blur(om,w,h,1,2),bOW=blur(OW,w,h,3,2),F=new Float32Array(N*3),Mu=new Uint8Array(N);const R=3;
      for(let j=0;j<P;j++){const i=idx[j],x=i%w,y=(i-x)/w;if(bO[i]<1e-7){Mu[i]=1;continue}
        /* tâm lọc: màu của chính điểm đó nếu đủ chắc, không thì trung bình quanh đó */
        let m0=bOW[i*3]/bO[i],m1=bOW[i*3+1]/bO[i],m2=bOW[i*3+2]/bO[i];if(om[i]&&seW[i]<12){m0=W1[i*3];m1=W1[i*3+1];m2=W1[i*3+2]}
        let s=0,a0=0,a1=0,a2=0;
        for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const q=yy*w+xx,o=om[q];if(!o)continue;
          const e0=W1[q*3]-m0,e1=W1[q*3+1]-m1,e2=W1[q*3+2]-m2,sr=2*(18*18+seW[q]*seW[q]),wt=o*Math.exp(-(dx*dx+dy*dy)/4.5-(e0*e0+e1*e1+e2*e2)/sr);s+=wt;a0+=wt*W1[q*3];a1+=wt*W1[q*3+1];a2+=wt*W1[q*3+2]}}
        if(s>1e-12){F[i*3]=a0/s;F[i*3+1]=a1/s;F[i*3+2]=a2/s}else{F[i*3]=m0;F[i*3+1]=m1;F[i*3+2]=m2}}
      for(let i=0;i<N;i++)if(!S[i])Mu[i]=1;
      /* điểm chưa có màu: điền mịn từ các điểm đã có */
      let anyU=false;for(let j=0;j<P;j++)if(Mu[idx[j]]){anyU=true;break}
      if(anyU){const kn=new Uint8Array(N);for(let j=0;j<P;j++)if(!Mu[idx[j]])kn[idx[j]]=1;const hole=new Uint8Array(N);for(let i=0;i<N;i++)hole[i]=kn[i]?0:1;harmonicFill(F,w,h,3,hole,30)}
      for(let j=0;j<P;j++)for(let c=0;c<3;c++)Wf[j*3+c]=clamp(F[idx[j]*3+c],0,255)}}
  else{/* nền gần như giống nhau ở mọi ảnh: giả định watermark đặc ở chỗ đậm nhất */
    let m=[0,0,0],n=0;for(let j=0;j<P;j++){const v=[0,0,0];for(let k=0;k<K;k++)for(let c=0;c<3;c++)v[c]+=(Iv[(k*P+j)*3+c]-Bv[(k*P+j)*3+c])/K;const d=Math.hypot(v[0],v[1],v[2]);if(d>n){n=d;for(let c=0;c<3;c++){let sB=0;for(let k=0;k<K;k++)sB+=Bv[(k*P+j)*3+c]/K;m[c]=sB+v[c]}}}
    Wg=m.map(v=>clamp(v,0,255));for(let j=0;j<P;j++)for(let c=0;c<3;c++)Wf[j*3+c]=Wg[c]}
  const cand={length:nRel};
  /* lượt 2: biết màu, tính alpha từng điểm (luôn ổn định vì màu watermark khác nền) */
  Rw.fill(1);
  for(let rep=0;rep<3;rep++)for(let j=0;j<P;j++){let num=0,den=0;
    for(let k=0;k<K;k++){const wt=Wv[k*P+j]*Rw[k*P+j],q=(k*P+j)*3;for(let c=0;c<3;c++){const d=Wf[j*3+c]-Bv[q+c];num+=wt*(Iv[q+c]-Bv[q+c])*d;den+=wt*d*d}}
    const al=den>1e-6?num/den:0;let ss=0;
    for(let k=0;k<K;k++){const q=(k*P+j)*3;let r=0;for(let c=0;c<3;c++){const e=Iv[q+c]-Bv[q+c]-al*(Wf[j*3+c]-Bv[q+c]);r+=e*e}res[k]=Math.sqrt(r/3*Wv[k*P+j]);ss+=Wv[k*P+j]*Rw[k*P+j]*r}
    const sc=1.4826*qsel(Float32Array.from(res),K,(K-1)>>1)+1e-3;for(let k=0;k<K;k++){const z=res[k]/sc;Rw[k*P+j]=z<=2?1:2/z}
    out.a[j]=al;out.se[j]=Math.sqrt(Math.max(ss/Math.max(1,3*K-1),1e-6)/Math.max(den,1e-9))}
  /* độ nhất quán: watermark thật có mặt trên TỪNG ảnh, nên alpha tính riêng trên mỗi ảnh (ảnh nào nền khác màu watermark)
     phải dương ở gần như mọi ảnh; báo nhầm thường chỉ do một hai ảnh tình cờ có nét trùng chỗ */
  out.cons=new Float32Array(P);
  for(let j=0;j<P;j++){const al=out.a[j];if(al<=0)continue;let n=0,ok=0;
    for(let k=0;k<K;k++){const q=(k*P+j)*3;let nu=0,de=0;for(let c=0;c<3;c++){const d=Wf[j*3+c]-Bv[q+c];nu+=(Iv[q+c]-Bv[q+c])*d;de+=d*d}if(de<3*25*25)continue;n++;if(nu/de>=.4*al)ok++}
    out.cons[j]=n?ok/n:1}
  for(let j=0;j<P;j++)for(let c=0;c<3;c++)out.W[j*3+c]=Wf[j*3+c];
  out.Wg=Wg;out.multi=multi;out.nRel=cand.length;
  /* kết quả lượt 1 (từng điểm tự do màu): tốt hơn khi watermark nhiều màu hoặc bị nén JPEG làm nhòe màu */
  out.a1=new Float32Array(P);out.W1=new Float32Array(P*3);for(let j=0;j<P;j++){const al=1-bA[j];out.a1[j]=al;for(let c=0;c<3;c++)out.W1[j*3+c]=al>.02?clamp(aA[j*3+c]/al,0,255):Wf[j*3+c]}
  return out;
}

/* Học mẫu cho một vùng: tìm đúng nét watermark, rồi mở rộng vùng nếu watermark còn tràn ra ngoài (bóng, quầng sáng). */
async function learnRegion(imgs,w,h,opt){
  const N=w*h,Kh=Math.min(imgs.length,Math.max(5,Math.floor(36e6/(N*3))));
  const st=hpStats(imgs.slice(0,Kh),w,h,opt.sigma||6),E=evidence(st,N,Kh),Mh=st.Mh,lo=.5,hi=1;
  let S0=hysteresis(E,w,h,lo,hi);dropSmall(S0,w,h,5);
  if(opt.add)for(let i=0;i<N;i++)if(opt.add[i])S0[i]=1;
  if(opt.cut)for(let i=0;i<N;i++)if(opt.cut[i])S0[i]=0;
  /* Vùng S phải phủ trọn cả phần watermark mờ nhất (bóng, quầng, viền khử răng cưa): nền mốc ngoài S mà còn dính
     watermark thì alpha bị tính thấp đi. Nên nới rộng tay, rồi lọc lại bằng kiểm định thống kê ở cuối. */
  let S=dilate(S0,w,h,opt.pad||6);if(opt.cut)for(let i=0;i<N;i++)if(opt.cut[i])S[i]=0;
  let fit=null;
  for(let g=0;g<8;g++){await tick();fit=fitMatte(imgs,w,h,S,opt);
    /* mép vùng S mà alpha vẫn rõ: watermark tràn ra, nới thêm */
    const sig=new Uint8Array(N);let nb=0,ns=0;
    for(let j=0;j<fit.P;j++){const i=fit.idx[j],x=i%w,y=(i-x)/w;const edge=(x>0&&!S[i-1])||(x<w-1&&!S[i+1])||(y>0&&!S[i-w])||(y<h-1&&!S[i+w]);if(!edge)continue;nb++;if(fit.a[j]>Math.max(.008,2.3*fit.se[j])){sig[i]=1;ns++}}
    if(ns<Math.max(8,nb*.015))break;
    const grow=dilate(sig,w,h,4);let added=0;for(let i=0;i<N;i++)if(grow[i]&&!S[i]&&!(opt.cut&&opt.cut[i])){S[i]=1;added++}
    if(!added)break}
  /* Lượt 2: vùng ôm sát đúng những điểm có watermark. Lỗ càng to thì nền đoán càng bị làm mịn, kéo alpha thấp
     đi (hồi quy về trung bình); lỗ ôm sát thì sai lệch này gần như mất. */
  /* ngưỡng thống kê: ít ảnh thì sai số ước lượng của chính sai số cũng lớn, phải khắt khe hơn (như bảng t) */
  const K=imgs.length,crit=2.6+6/K;
  if(opt.tight!==false){const Z0=new Uint8Array(N);for(let j=0;j<fit.P;j++)if(fit.a[j]>Math.max(.006,crit*fit.se[j]))Z0[fit.idx[j]]=1;
    dropSmall(Z0,w,h,3);const S2=dilate(Z0,w,h,opt.tpad||2);for(let i=0;i<N;i++)if(!S[i])S2[i]=0;
    let n2=0;for(let i=0;i<N;i++)n2+=S2[i];if(n2>20){await tick();S=S2;fit=fitMatte(imgs,w,h,S,opt)}}
  /* alpha cuối: chỉ giữ điểm có watermark thật (có ý nghĩa thống kê), bỏ hạt lẻ */
  const A=new Float32Array(N),Wc=new Float32Array(N*3),Z=new Uint8Array(N),p1=fit.multi&&opt.pass1!==false;
  const zs=new Float32Array(N),cs=new Float32Array(N);
  for(let j=0;j<fit.P;j++){const i=fit.idx[j],a=fit.a[j];zs[i]=a/Math.max(fit.se[j],1e-4);cs[i]=fit.cons[j];if(a>Math.max(.006,crit*fit.se[j])){A[i]=clamp(p1?fit.a1[j]:a,0,1);Z[i]=1}for(let c=0;c<3;c++)Wc[i*3+c]=p1?fit.W1[j*3+c]:fit.W[j*3+c]}
  /* chỉ giữ cụm điểm thành nét: cụm nhỏ, chỉ vừa chớm ngưỡng, hoặc không có mặt trên đa số ảnh là nhiễu */
  {const{lab,out}=comps(Z,w,h),sum=new Float64Array(out.length+1),sc=new Float64Array(out.length+1),sa=new Float64Array(out.length+1);
    for(let i=0;i<N;i++)if(Z[i]){sum[lab[i]]+=zs[i];sc[lab[i]]+=cs[i]*A[i];sa[lab[i]]+=A[i]}
    const bad=new Uint8Array(out.length+1),minC=opt.minCons==null?(K<10?.86:.72):opt.minCons;
    for(const c of out){const mz=sum[c.id]/c.n,mc=sa[c.id]>0?sc[c.id]/sa[c.id]:0;if(c.n<4||(c.n<40&&mz<crit+1.5)||mc<minC)bad[c.id]=1}
    for(let i=0;i<N;i++)if(Z[i]&&bad[lab[i]])Z[i]=0}
  for(let i=0;i<N;i++)if(!Z[i])A[i]=0;
  /* khử nhiễu alpha có giữ cạnh: trung bình với điểm lân cận có alpha gần giống (trong phạm vi sai số thống kê) */
  if(opt.denoise!==false){const SE=new Float32Array(N);for(let j=0;j<fit.P;j++)SE[fit.idx[j]]=Math.max(fit.se[j],.004);const DR=opt.dnR||1,DK=opt.dnK||2;
    for(let rep=0;rep<(opt.dnIt||2);rep++){const A0=Float32Array.from(A);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!Z[i])continue;const s2=2*Math.pow(DK*SE[i],2);let sw=0,sa=0;
        for(let dy=-DR;dy<=DR;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-DR;dx<=DR;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const q=yy*w+xx;if(!Z[q])continue;const d=A0[q]-A0[i],wq=Math.exp(-d*d/s2)/(SE[q]*SE[q]);sw+=wq;sa+=wq*A0[q]}}
        A[i]=sa/sw}}}
  let dbg=null;if(opt.debug&&fit.a1){dbg={A1:new Float32Array(N),W1:new Float32Array(N*3)};for(let j=0;j<fit.P;j++){const i=fit.idx[j];if(Z[i]){dbg.A1[i]=clamp(fit.a1[j],0,1);for(let c=0;c<3;c++)dbg.W1[i*3+c]=fit.W1[j*3+c]}}}
  return{A,Wc,S,Mh,Wg:fit.Wg,multi:fit.multi,nRel:fit.nRel,lo,hi,dbg};
}

/* Học mẫu từ danh sách ảnh (File/Blob) của một nhà sỉ. */
async function learnTemplate(files,opt){
  opt=opt||{};const prog=opt.onProgress||(()=>{}),MAXI=opt.maxImages||32;
  /* 1. gom ảnh theo khổ, lấy nhóm đông nhất */
  const info=[];
  for(let i=0;i<files.length&&info.length<80;i++){try{const b=await decode(files[i]),[w,h]=dims(b);shut(b);info.push({f:files[i],w,h})}catch(e){}prog("Đọc ảnh",i/files.length*.1)}
  const MINI=opt.minImages||5;
  if(info.length<MINI)return{ok:false,code:"few",n:info.length,need:MINI};
  const by=new Map();for(const it of info){const k=it.w+"x"+it.h;if(!by.has(k))by.set(k,[]);by.get(k).push(it)}
  let grp=[...by.values()].sort((a,b)=>b.length-a.length)[0];
  const rw=grp[0].w,rh=grp[0].h;
  if(grp.length<Math.min(6,info.length)){/* thêm ảnh cùng tỉ lệ khung, khác cỡ: kéo về cùng cỡ */
    const ar=rw/rh;grp=grp.concat(info.filter(it=>!(it.w===rw&&it.h===rh)&&Math.abs(it.w/it.h-ar)/ar<.01))}
  if(grp.length<MINI)return{ok:false,code:"few",n:grp.length,need:MINI};
  const use=grp.length>MAXI?grp.filter((_,i)=>i%Math.ceil(grp.length/MAXI)===0).slice(0,MAXI):grp;
  /* vùng tô sửa của người dùng (canvas cỡ bất kỳ, cùng tỉ lệ ảnh) -> mặt nạ ở khổ gốc */
  const toMask=cv=>{if(!cv)return null;const t=drawTo(cv,rw,rh),d=g2d(t).getImageData(0,0,rw,rh).data,m=new Uint8Array(rw*rh);let any=false;for(let i=0;i<m.length;i++)if(d[i*4+3]>40){m[i]=1;any=true}return any?m:null};
  opt=Object.assign({},opt);if(opt.addC)opt.add=toMask(opt.addC);if(opt.cutC)opt.cut=toMask(opt.cutC);
  /* 2. dò thô trên ảnh thu nhỏ để tìm các vùng có watermark */
  const sc=Math.min(1,560/Math.max(rw,rh)),lw=Math.max(16,Math.round(rw*sc)),lh=Math.max(16,Math.round(rh*sc)),low=[];
  for(let i=0;i<use.length&&low.length<24;i++){const b=await decode(use[i].f);low.push(readRGB8(drawTo(b,lw,lh),0,0,lw,lh));shut(b);prog("So các ảnh",.1+.2*i/Math.min(24,use.length))}
  const st=hpStats(low,lw,lh,Math.max(1.5,6*sc)),E=evidence(st,lw*lh,low.length);
  const Sl=hysteresis(E,lw,lh,.5,1);dropSmall(Sl,lw,lh,4);
  if(opt.add)for(let y=0;y<lh;y++)for(let x=0;x<lw;x++)if(opt.add[Math.floor(y/lh*rh)*rw+Math.floor(x/lw*rw)])Sl[y*lw+x]=1;
  if(opt.cut)for(let y=0;y<lh;y++)for(let x=0;x<lw;x++)if(opt.cut[Math.floor(y/lh*rh)*rw+Math.floor(x/lw*rw)])Sl[y*lw+x]=0;
  const grpM=dilate(Sl,lw,lh,Math.max(3,Math.round(lw/60)));
  const{out}=comps(grpM,lw,lh);
  const MG=48;let regs=out.filter(c=>c.n>=6).map(c=>({x0:Math.max(0,Math.floor(c.x0/sc)-MG),y0:Math.max(0,Math.floor(c.y0/sc)-MG),x1:Math.min(rw-1,Math.ceil((c.x1+1)/sc)+MG),y1:Math.min(rh-1,Math.ceil((c.y1+1)/sc)+MG)}));
  const merge=()=>{for(let ch=true;ch;){ch=false;for(let i=0;i<regs.length&&!ch;i++)for(let j=i+1;j<regs.length;j++){const a=regs[i],b=regs[j];if(a.x0<=b.x1+8&&b.x0<=a.x1+8&&a.y0<=b.y1+8&&b.y0<=a.y1+8){regs[i]={x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)};regs.splice(j,1);ch=true;break}}}};
  merge();
  if(!regs.length)return{ok:false,code:"none",n:use.length};
  /* 3. học chính xác ở độ phân giải gốc, từng vùng; watermark chạm mép vùng thì nới vùng rồi học lại */
  const A=new Float32Array(rw*rh),Wc=new Float32Array(rw*rh*3);let parts=[],DB1=null;
  for(let round=0;round<3;round++){DB1=null;
    const crops=regs.map(()=>[]);
    for(let i=0;i<use.length;i++){const b=await decode(use[i].f),c=drawTo(b,rw,rh);shut(b);
      regs.forEach((r,ri)=>crops[ri].push(readRGB8(c,r.x0,r.y0,r.x1-r.x0+1,r.y1-r.y0+1)));prog("Đọc ảnh gốc",.3+.15*i/use.length)}
    A.fill(0);Wc.fill(0);parts=[];let grew=false;
    for(let ri=0;ri<regs.length;ri++){const r=regs[ri],w=r.x1-r.x0+1,h=r.y1-r.y0+1;
      const sub=m=>{if(!m)return null;const o=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)o[y*w+x]=m[(r.y0+y)*rw+r.x0+x];return o};
      const L=await learnRegion(crops[ri],w,h,{...(opt.ro||{}),add:sub(opt.add),cut:sub(opt.cut),debug:opt.debug,prog:()=>prog("Tính từng điểm watermark",.45+.5*(ri+.5)/regs.length)});
      if(L.dbg){DB1=DB1||{A:new Float32Array(rw*rh),W:new Float32Array(rw*rh*3)};for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=(r.y0+y)*rw+r.x0+x;if(L.dbg.A1[i]>0){DB1.A[j]=L.dbg.A1[i];for(let c=0;c<3;c++)DB1.W[j*3+c]=L.dbg.W1[i*3+c]}}}
      let n=0,tl=0,tr=0,tt=0,tb=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=(r.y0+y)*rw+r.x0+x;if(L.A[i]>0){A[j]=Math.max(A[j],L.A[i]);n++;if(x<3)tl++;if(x>=w-3)tr++;if(y<3)tt++;if(y>=h-3)tb++}for(let c=0;c<3;c++)if(L.A[i]>0||!Wc[j*3+c])Wc[j*3+c]=L.Wc[i*3+c]}
      parts.push({x0:r.x0,y0:r.y0,w,h,n,Wg:L.Wg,multi:L.multi});crops[ri]=null;
      const E2=96;
      if(tl>2&&r.x0>0){r.x0=Math.max(0,r.x0-E2);grew=true}if(tr>2&&r.x1<rw-1){r.x1=Math.min(rw-1,r.x1+E2);grew=true}
      if(tt>2&&r.y0>0){r.y0=Math.max(0,r.y0-E2);grew=true}if(tb>2&&r.y1<rh-1){r.y1=Math.min(rh-1,r.y1+E2);grew=true}}
    if(!grew)break;merge()}
  /* watermark lặp kín ảnh: lấp các đoạn bị sót từ các bản sao khác */
  let tiled=0;if(opt.tiles!==false){try{tiled=tileComplete(A,Wc,rw,rh)}catch(e){tiled=0}}
  prog("Xong",1);
  const tpl=pack(A,Wc,rw,rh);if(!tpl)return{ok:false,code:"none",n:use.length};tpl.tiled=tiled;
  return{ok:true,tpl,n:use.length,parts,rw,rh,dbg:DB1?{tpl1:pack(DB1.A,DB1.W,rw,rh),A,Wc}:null};
}
/* ---------- watermark lặp kín ảnh (chữ chéo lặp đi lặp lại) ----------
   Các bản sao giống hệt nhau, xếp theo một lưới đều. Tìm hai véc-tơ của lưới bằng tự tương quan (FFT) của bản đồ alpha,
   rồi lấp những đoạn bị sót ở bản sao này bằng các bản sao khác (theo đa số). Chỉ làm khi lưới lặp thật sự rõ. */
function fft1(re,im,inv){const n=re.length;
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const ang=2*Math.PI/len*(inv?1:-1),wr=Math.cos(ang),wi=Math.sin(ang),h=len>>1;
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<h;j++){const a=i+j,b=a+h,xr=re[b]*cr-im[b]*ci,xi=re[b]*ci+im[b]*cr;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}
  if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n}}
function fft2(re,im,W,H,inv){const r=new Float64Array(Math.max(W,H)),m=new Float64Array(Math.max(W,H));
  for(let y=0;y<H;y++){const rr=re.subarray(y*W,y*W+W),ii=im.subarray(y*W,y*W+W);fft1(rr,ii,inv)}
  const cr=new Float64Array(H),ci=new Float64Array(H);for(let x=0;x<W;x++){for(let y=0;y<H;y++){cr[y]=re[y*W+x];ci[y]=im[y*W+x]}fft1(cr,ci,inv);for(let y=0;y<H;y++){re[y*W+x]=cr[y];im[y*W+x]=ci[y]}}}
let TILEDBG=null;
function tileComplete(A,Wc,rw,rh){TILEDBG={};
  const f=4,dw=Math.ceil(rw/f),dh=Math.ceil(rh/f),a=new Float64Array(dw*dh);let n0=0;
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const v=A[y*rw+x];if(v>0){a[((y/f)|0)*dw+((x/f)|0)]+=v;n0++}}
  TILEDBG.n0=n0;if(n0<400)return 0;
  let P=1;while(P<2*dw)P<<=1;let Q=1;while(Q<2*dh)Q<<=1;
  const re=new Float64Array(P*Q),im=new Float64Array(P*Q);let mean=0;for(const v of a)mean+=v;mean/=a.length;
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++)re[y*P+x]=a[y*dw+x]-mean;
  fft2(re,im,P,Q,false);for(let i=0;i<P*Q;i++){re[i]=re[i]*re[i]+im[i]*im[i];im[i]=0}fft2(re,im,P,Q,true);
  const R0=re[0];if(!(R0>0))return 0;
  const at=(dx,dy)=>re[((dy%Q)+Q)%Q*P+((dx%P)+P)%P]/R0;
  /* đỉnh tự tương quan (bỏ vùng quanh gốc, độ dời không quá nửa ảnh) */
  const peaks=[],mx=Math.floor(dw*.6),my=Math.floor(dh*.6);
  for(let dy=-my;dy<=my;dy++)for(let dx=0;dx<=mx;dx++){if(dx===0&&dy<=0)continue;if(dx*dx+dy*dy<64)continue;const v=at(dx,dy);if(v<.1)continue;
    let isMax=true;for(let ey=-2;ey<=2&&isMax;ey++)for(let ex=-2;ex<=2;ex++){if(!ex&&!ey)continue;if(at(dx+ex,dy+ey)>v){isMax=false;break}}
    if(isMax)peaks.push([v,dx,dy])}
  TILEDBG.peaks=peaks.length;if(!peaks.length)return 0;peaks.sort((p,q)=>q[0]-p[0]);
  const refine=(dx,dy)=>{const c=at(dx,dy),l=at(dx-1,dy),r=at(dx+1,dy),u=at(dx,dy-1),d=at(dx,dy+1),ox=(l-r)/(2*(l-2*c+r)||1),oy=(u-d)/(2*(u-2*c+d)||1);return[(dx+clamp(ox,-.5,.5))*f,(dy+clamp(oy,-.5,.5))*f]};
  /* lấy mẫu song tuyến alpha/màu tại điểm lệch */
  const samp=(X,Y)=>{if(X<0||Y<0||X>rw-1.001||Y>rh-1.001)return null;const x0=X|0,y0=Y|0,fx=X-x0,fy=Y-y0,i=y0*rw+x0;
    const a00=A[i],a10=A[i+1],a01=A[i+rw],a11=A[i+rw+1];return(a00*(1-fx)+a10*fx)*(1-fy)+(a01*(1-fx)+a11*fx)*fy};
  /* Đỉnh cao nhất chưa chắc là lưới thật (các dòng chữ thẳng hàng cũng tạo đỉnh). Chấm từng ứng viên bằng độ khớp thực:
     dời theo véc-tơ đó thì bao nhiêu điểm watermark rơi đúng vào điểm watermark của bản sao bên cạnh. */
  const pts=[];for(let y=0;y<rh;y+=3)for(let x=0;x<rw;x+=3)if(A[y*rw+x]>.05)pts.push(x,y);
  const cons=v=>{let n=0,on=0;for(let k=0;k<pts.length;k+=2){for(const sg of[1,-1]){const s=samp(pts[k]+sg*v[0],pts[k+1]+sg*v[1]);if(s==null)continue;n++;if(s>.02)on++}}return n>=100?on/n:0};
  const cands=peaks.slice(0,40).map(p=>{const v=refine(p[1],p[2]);return{v,s:cons(v)}}).sort((p,q)=>q.s-p.s);
  TILEDBG.top=cands.slice(0,5).map(c=>[+c.s.toFixed(2),Math.round(c.v[0]),Math.round(c.v[1])]);
  if(!cands.length||cands[0].s<.6)return 0;
  const v1=cands[0].v;let v2=null;
  for(const c of cands.slice(1)){if(c.s<.6)break;const cr=Math.abs(v1[0]*c.v[1]-v1[1]*c.v[0])/(Math.hypot(...v1)*Math.hypot(...c.v));if(cr>.35){v2=c.v;break}}
  TILEDBG.v1=v1;TILEDBG.v2=v2;
  const offs=[];const K=v2?3:5;for(let i=-K;i<=K;i++)for(let j=v2?-K:0;j<=(v2?K:0);j++){if(!i&&!j)continue;offs.push([i*v1[0]+(v2?j*v2[0]:0),i*v1[1]+(v2?j*v2[1]:0)])}
  /* kiểm tra lưới có thật: điểm có watermark thì các bản sao lân cận cũng phải có */
  let chk=0,ok=0;for(let y=0;y<rh;y+=3)for(let x=0;x<rw;x+=3){const i=y*rw+x;if(A[i]<.05)continue;let n=0,on=0;for(const o of offs){const s=samp(x+o[0],y+o[1]);if(s==null)continue;n++;if(s>.02)on++}if(n>=2){chk++;if(on/n>=.5)ok++}}
  TILEDBG.chk=chk;TILEDBG.ok=ok;if(chk<100||ok/chk<.55)return 0;
  /* lấp chỗ sót: đa số bản sao có watermark mà chỗ này chưa có */
  const add=new Float32Array(rw*rh),Wadd=new Float32Array(rw*rh*3);let filled=0;const vals=[],ws=[];
  for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=y*rw+x;if(A[i]>0)continue;vals.length=0;ws.length=0;let n=0;
    for(const o of offs){const X=x+o[0],Y=y+o[1],s=samp(X,Y);if(s==null)continue;n++;if(s>.01){vals.push(s);ws.push(Math.round(Y)*rw+Math.round(X))}}
    if(n<3||vals.length<Math.max(3,.6*n))continue;vals.sort((p,q)=>p-q);add[i]=vals[vals.length>>1];
    for(let c=0;c<3;c++){const cs=ws.map(j=>Wc[j*3+c]).sort((p,q)=>p-q);Wadd[i*3+c]=cs[cs.length>>1]}filled++}
  for(let i=0;i<rw*rh;i++)if(add[i]>0){A[i]=add[i];for(let c=0;c<3;c++)Wc[i*3+c]=Wadd[i*3+c]}
  TILEDBG.filled=filled;return filled;
}
/* gói mẫu: chỉ giữ khung bao quanh phần có alpha */
function pack(A,Wc,rw,rh){
  let x0=rw,y0=rh,x1=-1,y1=-1;for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)if(A[y*rw+x]>0){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return null;const w=x1-x0+1,h=y1-y0+1,a=new Float32Array(w*h),W=new Float32Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=(y0+y)*rw+x0+x;a[i]=A[j];for(let c=0;c<3;c++)W[i*3+c]=Wc[j*3+c]}
  return{v:2,rw,rh,x:x0,y:y0,w,h,a,W};
}

/* =================== ÁP MẪU LÊN MỘT ẢNH =================== */
/* năng lượng cạnh trùng hướng với cạnh của watermark: còn watermark thì cao, xóa sạch thì thấp */
function edgeEnergy(D,w,h,A){
  let e=0,n=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,ax=(A[i+1]-A[i-1])/2,ay=(A[i+w]-A[i-w])/2,g=Math.hypot(ax,ay);if(g<.03)continue;
    const L=j=>.299*D[j*3]+.587*D[j*3+1]+.114*D[j*3+2];const lx=(L(i+1)-L(i-1))/2,ly=(L(i+w)-L(i-w))/2;e+=Math.abs(lx*ax+ly*ay);n+=g*g}
  return n?e/n:0;
}
/* đặt mẫu (khổ tham chiếu rw×rh) lên ảnh iw×ih: cùng tỉ lệ thì co giãn theo khổ */
function placement(T,iw,ih){return{sx:iw/T.rw,sy:ih/T.rh,tx:0,ty:0}}
/* lấy alpha và màu của mẫu trên lưới ảnh (nội suy song tuyến), trong khung [bx,by,bw,bh] */
function warp(T,tf,bx,by,bw,bh){
  const A=new Float32Array(bw*bh),W=new Float32Array(bw*bh*3);
  for(let y=0;y<bh;y++){const ty=((by+y+.5-tf.ty)/tf.sy-.5)-T.y;if(ty<-1||ty>T.h)continue;const y0=Math.floor(ty),fy=ty-y0;
    for(let x=0;x<bw;x++){const tx=((bx+x+.5-tf.tx)/tf.sx-.5)-T.x;if(tx<-1||tx>T.w)continue;const x0=Math.floor(tx),fx=tx-x0;
      let a=0,wsum=0;const c3=[0,0,0];
      for(let k=0;k<4;k++){const xx=x0+(k&1),yy=y0+(k>>1);if(xx<0||yy<0||xx>=T.w||yy>=T.h)continue;const wt=((k&1)?fx:1-fx)*((k>>1)?fy:1-fy),j=yy*T.w+xx,aj=T.a[j];a+=wt*aj;
        if(aj>0){c3[0]+=wt*aj*T.W[j*3];c3[1]+=wt*aj*T.W[j*3+1];c3[2]+=wt*aj*T.W[j*3+2];wsum+=wt*aj}}
      const i=y*bw+x;A[i]=a;if(wsum>0){W[i*3]=c3[0]/wsum;W[i*3+1]=c3[1]/wsum;W[i*3+2]=c3[2]/wsum}}}
  return{A,W};
}
/* Ảnh này có đúng watermark đó, đúng chỗ đó không? So hai giả thuyết trên các điểm watermark:
   "không có watermark" (ảnh = nền đoán từ xung quanh) và "có watermark" (ảnh = alpha*màu + (1-alpha)*nền).
   Trả về mức giảm sai số khi giả định có watermark: gần 1 là chắc chắn có, âm là không có. */
function presence(D,B,w,h,A,W){
  let en=0,ew=0;
  for(let i=0;i<w*h;i++){const a=A[i];if(a<=.04)continue;
    for(let c=0;c<3;c++){const d=D[i*3+c],b=B[i*3+c],p=a*W[i*3+c]+(1-a)*b;en+=(d-b)*(d-b);ew+=(d-p)*(d-p)}}
  return en>1e-6?1-ew/en:0;
}
/* Xóa watermark theo mẫu trên canvas (sửa tại chỗ). Tự căn lệch tới ±2 điểm ảnh.
   Trả về {ok, found, score, dx, dy}. Ảnh không có watermark thì để nguyên. */
/* Các cách đặt mẫu lên ảnh. Cùng tỉ lệ khung: co giãn theo khổ. Khác tỉ lệ (ảnh bị cắt vuông, xoay khổ...): thử vài cỡ
   (theo bề ngang, chiều cao, diện tích) và vài cách neo (giữ tỉ lệ vị trí, giữ khoảng cách tới mép gần nhất, tới tâm). */
function placeCands(T,iw,ih){
  const a0=T.rw/T.rh,a1=iw/ih;if(Math.abs(a1-a0)/a0<.01)return[placement(T,iw,ih)];
  const cx=T.x+T.w/2,cy=T.y+T.h/2,out=[],seen=new Set();
  for(const s of[iw/T.rw,ih/T.rh,Math.sqrt(iw*ih/(T.rw*T.rh))]){
    const ax=[cx/T.rw*iw,cx*s,iw-(T.rw-cx)*s,iw/2+(cx-T.rw/2)*s],ay=[cy/T.rh*ih,cy*s,ih-(T.rh-cy)*s,ih/2+(cy-T.rh/2)*s];
    for(const X of ax)for(const Y of ay){const tf={sx:s,sy:s,tx:X-cx*s,ty:Y-cy*s},k=[s.toFixed(3),Math.round(tf.tx/3),Math.round(tf.ty/3)].join();if(!seen.has(k)){seen.add(k);out.push(tf)}}}
  return out;
}
/* chấm một cách đặt: đọc vùng ảnh quanh mẫu, đoán nền, so giả thuyết có/không có watermark, dời tinh ±SH điểm */
function evalPlace(c,T,tf0,SH,ctxM){
  const iw=c.width,ih=c.height,mg=4+SH,bx=Math.max(0,Math.floor(T.x*tf0.sx+tf0.tx)-mg),by=Math.max(0,Math.floor(T.y*tf0.sy+tf0.ty)-mg),
    bx1=Math.min(iw,Math.ceil((T.x+T.w)*tf0.sx+tf0.tx)+mg),by1=Math.min(ih,Math.ceil((T.y+T.h)*tf0.sy+tf0.ty)+mg);
  if(bx1-bx<2||by1-by<2)return null;
  const rx=Math.max(0,bx-ctxM),ry=Math.max(0,by-ctxM),rw=Math.min(iw,bx1+ctxM)-rx,rh=Math.min(ih,by1+ctxM)-ry,D=readRGB(c,rx,ry,rw,rh);
  const Wp=warp(T,tf0,rx,ry,rw,rh),hole=new Uint8Array(rw*rh);for(let i=0;i<hole.length;i++)hole[i]=Wp.A[i]>.003?1:0;
  const Hd=dilate(hole,rw,rh,2+SH),B=Float32Array.from(D);harmonicFill(B,rw,rh,3,Hd,30);
  let best={s:presence(D,B,rw,rh,Wp.A,Wp.W),dx:0,dy:0,W:Wp};
  if(SH>0){/* thử dời mẫu từng nửa điểm ảnh, lấy vị trí khớp nhất */
    for(let r=0;r<2;r++){const st=r?.5:1,cx=best.dx,cy=best.dy,lim=r?.5:SH;
      for(let dy=-lim;dy<=lim+1e-9;dy+=st)for(let dx=-lim;dx<=lim+1e-9;dx+=st){if(!dx&&!dy)continue;const X=cx+dx,Y=cy+dy;if(Math.abs(X)>SH||Math.abs(Y)>SH)continue;
        const W2=warp(T,{sx:tf0.sx,sy:tf0.sy,tx:tf0.tx+X,ty:tf0.ty+Y},rx,ry,rw,rh),s=presence(D,B,rw,rh,W2.A,W2.W);if(s>best.s+.002)best={s,dx:X,dy:Y,W:W2}}}}
  return Object.assign(best,{D,rx,ry,rw,rh});
}
async function applyTemplate(c,T,opt){
  opt=opt||{};const SH=opt.shift==null?2:opt.shift,cands=placeCands(T,c.width,c.height);
  let best=null;
  if(cands.length===1)best=evalPlace(c,T,cands[0],SH,128);
  else{/* khác tỉ lệ khung: chấm nhanh từng cách đặt (không dời tinh), rồi chấm kỹ cách tốt nhất */
    let top=null;for(const tf of cands){const r=evalPlace(c,T,tf,0,16);if(r&&(!top||r.s>top.r.s))top={r,tf};await tick()}
    if(top&&top.r.s>0)best=evalPlace(c,T,top.tf,SH,128)}
  if(!best)return{ok:true,found:false,score:-1};
  const found=best.s>=(opt.minScore==null?.1:opt.minScore);
  if(!found&&!opt.force)return{ok:true,found:false,score:best.s,dx:best.dx,dy:best.dy};
  const u=await unblend(best.D,best.rw,best.rh,best.W.A,best.W.W,opt);writeRGB(c,best.D,best.rx,best.ry,best.rw,best.rh);
  return{ok:true,found:true,score:best.s,dx:best.dx,dy:best.dy,filled:u.filled,how:u.how,placed:cands.length>1};
}

/* =================== XÓA VÙNG TÔ TAY TRÊN MỘT ẢNH ===================
   Vùng tô chỉ là "chỗ cần tìm". Trong đó, nét chữ/logo là những điểm lệch khỏi nền xung quanh theo cùng một hướng màu
   (chữ trắng thì sáng hơn nền, chữ đen thì tối hơn). Dò đúng các điểm đó (kể cả viền hoặc bóng ngược màu sát bên),
   ước lượng màu watermark và độ đục từng điểm, rồi khử như khi có mẫu. Phần nền trong vùng tô giữ nguyên. */
function solve3(A,b){const[a,bb,c,d,e,f,g,h,i]=A,det=a*(e*i-f*h)-bb*(d*i-f*g)+c*(d*h-e*g);if(Math.abs(det)<1e-9)return null;
  return[(b[0]*(e*i-f*h)-bb*(b[1]*i-f*b[2])+c*(b[1]*h-e*b[2]))/det,(a*(b[1]*i-f*b[2])-b[0]*(d*i-f*g)+c*(d*b[2]-b[1]*g))/det,(a*(e*b[2]-b[1]*h)-bb*(d*b[2]-b[1]*g)+b[0]*(d*h-e*g))/det]}
/* màu watermark = điểm mà mọi đường thẳng (nền -> ảnh) cùng đi qua; nền đều quá thì coi chỗ đậm nhất là watermark đặc */
function lineColor(D,B,list,u,tmax){
  const M=[0,0,0,0,0,0,0,0,0],r=[0,0,0];let n=0;const Bm=[0,0,0];
  for(const i of list){const d=[D[i*3]-B[i*3],D[i*3+1]-B[i*3+1],D[i*3+2]-B[i*3+2]],L=Math.hypot(d[0],d[1],d[2]);if(L<6)continue;const w=L*L;for(let c=0;c<3;c++){d[c]/=L;Bm[c]+=B[i*3+c]}n++;
    for(let a=0;a<3;a++)for(let b=0;b<3;b++){const p=w*((a===b?1:0)-d[a]*d[b]);M[a*3+b]+=p;r[a]+=p*D[i*3+b]}}
  const fall=[0,1,2].map(c=>clamp((n?Bm[c]/n:128)+tmax*u[c],0,255));if(n<20)return fall;
  /* điều kiện hóa: thêm một chút kéo về phương án dự phòng để không trôi khi các đường gần song song */
  const tr=(M[0]+M[4]+M[8])/3,lam=tr*.02;for(let a=0;a<3;a++){M[a*3+a]+=lam;r[a]+=lam*fall[a]}
  const W=solve3(M,r);return W?W.map(v=>clamp(v,0,255)):fall;
}
/* Chọn màu watermark bền vững: thử vài ứng viên (giao điểm các đường, trắng, đen, chỗ đậm nhất, các mức xám), chấm bằng
   sai số có cắt ngọn trên toàn bộ nét. Màu đúng làm phần lệch của MỌI điểm cùng hướng (watermark - nền). */
function pickColor(D,B,list,u,tmax){
  const st=Math.max(1,Math.floor(list.length/5000)),Bm=[0,0,0];let n=0;for(let q=0;q<list.length;q+=st){const i=list[q];for(let c=0;c<3;c++)Bm[c]+=B[i*3+c];n++}
  for(let c=0;c<3;c++)Bm[c]/=Math.max(1,n);
  const cands=[lineColor(D,B,list,u,tmax),[255,255,255],[0,0,0],[0,1,2].map(c=>clamp(Bm[c]+tmax*u[c],0,255))];
  const gray=(Bm[0]+Bm[1]+Bm[2])/3;for(const g of[.25,.5,.75])cands.push([0,1,2].map(()=>clamp(gray+(u[0]+u[1]+u[2]>0?255-gray:-gray)*g+(u[0]+u[1]+u[2]>0?0:0),0,255)));
  let best=null;
  for(const W of cands){let s=0,m=0;
    for(let q=0;q<list.length;q+=st){const i=list[q],d0=D[i*3]-B[i*3],d1=D[i*3+1]-B[i*3+1],d2=D[i*3+2]-B[i*3+2];if(d0*d0+d1*d1+d2*d2<36)continue;
      const w0=W[0]-B[i*3],w1=W[1]-B[i*3+1],w2=W[2]-B[i*3+2],de=w0*w0+w1*w1+w2*w2;if(de<100){s+=400;m++;continue}
      const a=clamp((d0*w0+d1*w1+d2*w2)/de,0,1),e0=d0-a*w0,e1=d1-a*w1,e2=d2-a*w2;s+=Math.min(400,e0*e0+e1*e1+e2*e2);m++}
    const sc=m?s/m:1e9;if(!best||sc<best.s)best={s:sc,W}}
  return best.W.map(v=>clamp(v,0,255));
}
async function removeBrush(c,brush,opt){
  opt=opt||{};const iw=c.width,ih=c.height;let x0=iw,y0=ih,x1=-1,y1=-1;
  for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)if(brush[y*iw+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return{changed:false};
  const m=Math.max(10,Math.round(Math.min(iw,ih)*.015)),rx=Math.max(0,x0-m),ry=Math.max(0,y0-m),rw=Math.min(iw,x1+m+1)-rx,rh=Math.min(ih,y1+m+1)-ry,N=rw*rh;
  const D=readRGB(c,rx,ry,rw,rh),R=new Uint8Array(N);for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)R[y*rw+x]=brush[(ry+y)*iw+rx+x]?1:0;
  /* nhiễu ảnh: đo ở vành ngoài vùng tô */
  const g=blur(D,rw,rh,3,1.2),hp=[];for(let i=0;i<N;i++)if(!R[i])for(let k=0;k<3;k++)hp.push(Math.abs(D[i*3+k]-g[i*3+k]));
  hp.sort((a,b)=>a-b);const sn=Math.max(1.2,1.4826*(hp[hp.length>>1]||1));
  /* 1. nền đoán thô (giả định vùng tô phủ hết watermark) và hướng màu chính của phần lệch */
  let B=Float32Array.from(D);harmonicFill(B,rw,rh,3,R,40);
  const C=[0,0,0,0,0,0,0,0,0];for(let i=0;i<N;i++){if(!R[i])continue;const d0=D[i*3]-B[i*3],d1=D[i*3+1]-B[i*3+1],d2=D[i*3+2]-B[i*3+2],L2=d0*d0+d1*d1+d2*d2;if(L2<9*sn*sn)continue;const d=[d0,d1,d2];for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a*3+b]+=d[a]*d[b]}
  let u=[.577,.577,.577];for(let it=0;it<30;it++){const v=[0,1,2].map(a=>C[a*3]*u[0]+C[a*3+1]*u[1]+C[a*3+2]*u[2]),L=Math.hypot(v[0],v[1],v[2]);if(L<1e-9)break;u=v.map(x=>x/L)}
  const proj=new Float32Array(N);for(let i=0;i<N;i++)proj[i]=R[i]?(D[i*3]-B[i*3])*u[0]+(D[i*3+1]-B[i*3+1])*u[1]+(D[i*3+2]-B[i*3+2])*u[2]:0;
  {const s=[];for(let i=0;i<N;i++)if(R[i])s.push(proj[i]);s.sort((a,b)=>a-b);const lo=s[Math.floor(s.length*.02)]||0,hi=s[Math.floor(s.length*.98)]||0;if(-lo>hi){u=u.map(x=>-x);for(let i=0;i<N;i++)proj[i]=-proj[i]}}
  /* 2. nét chính: lệch rõ theo hướng màu chính; nét phụ ngược màu (viền, bóng) chỉ nhận khi sát nét chính */
  const lo=2.5*sn+2,hi=5*sn+4;let S=hysteresis(proj,rw,rh,lo,hi);for(let i=0;i<N;i++)if(!R[i])S[i]=0;dropSmall(S,rw,rh,3);
  const neg=new Float32Array(N);for(let i=0;i<N;i++)neg[i]=-proj[i];let S2=hysteresis(neg,rw,rh,lo,hi);const near=dilate(S,rw,rh,3);
  let s1=0,s2=0;for(let i=0;i<N;i++){if(!R[i]||!near[i])S2[i]=0;if(S[i])s1+=proj[i];if(S2[i])s2+=neg[i]}
  if(s2<.15*s1)S2=new Uint8Array(N);
  let all=new Uint8Array(N),cnt=0;for(let i=0;i<N;i++)if(S[i]||S2[i]){all[i]=1;cnt++}
  if(cnt<6)return{changed:false,found:0};
  /* 3. nền đoán lại, chỉ bỏ đúng các nét (nền giữa các chữ được dùng làm mốc) */
  const hole=dilate(all,rw,rh,1.5);B=Float32Array.from(D);harmonicFill(B,rw,rh,3,hole,40);
  /* 4. màu từng nhóm nét, rồi độ đục từng điểm */
  const L1=[],L2=[];let t1=0,t2=0;
  for(let i=0;i<N;i++){if(!hole[i])continue;const t=(D[i*3]-B[i*3])*u[0]+(D[i*3+1]-B[i*3+1])*u[1]+(D[i*3+2]-B[i*3+2])*u[2];if(t>=0){L1.push(i);if(t>t1)t1=t}else{L2.push(i);if(-t>t2)t2=-t}}
  let hasNeg=false;for(let i=0;i<N;i++)if(S2[i]){hasNeg=true;break}
  const Wp=pickColor(D,B,L1,u,t1),Wn=hasNeg&&L2.length?pickColor(D,B,L2,u.map(x=>-x),t2):null;
  /* độ đục từng điểm theo nền đoán (chỉ tin được ở nền phẳng) */
  const Ae=new Float32Array(N),grp=new Int8Array(N),rel=new Float32Array(N),Wc=new Float32Array(N*3);
  const Gb=new Float32Array(N);for(let y=1;y<rh-1;y++)for(let x=1;x<rw-1;x++){const i=y*rw+x;let s=0;for(let k=0;k<3;k++){const gx=B[(i+1)*3+k]-B[(i-1)*3+k],gy=B[(i+rw)*3+k]-B[(i-rw)*3+k];s+=gx*gx+gy*gy}Gb[i]=s}
  for(let i=0;i<N;i++){if(!hole[i])continue;const t=(D[i*3]-B[i*3])*u[0]+(D[i*3+1]-B[i*3+1])*u[1]+(D[i*3+2]-B[i*3+2])*u[2],neg=t<0&&Wn,W=neg?Wn:Wp;
    let nu=0,de=0;for(let k=0;k<3;k++){const d=W[k]-B[i*3+k];nu+=(D[i*3+k]-B[i*3+k])*d;de+=d*d}
    Ae[i]=de>1?clamp(nu/de,0,1):0;grp[i]=neg?-1:1;rel[i]=de/(400+Gb[i]*6);for(let k=0;k<3;k++)Wc[i*3+k]=W[k]}
  /* Watermark thật thường đục đều trên cả nét, chỉ đổi ở mép (khử răng cưa). Nên: độ đục chung lấy trung bình cục bộ có
     trọng số từ những điểm đáng tin; điểm trong lòng nét dùng độ đục chung (không phụ thuộc nền đoán), điểm ở mép dùng
     ước lượng riêng nhưng không vượt độ đục chung. Watermark đục không đều (quầng sáng, chuyển màu) vẫn theo được nhờ
     trung bình cục bộ. */
  const A=new Float32Array(N),inner=erode(all,rw,rh,1.5);
  for(const sg of[1,-1]){
    const vals=[];for(let i=0;i<N;i++)if(inner[i]&&grp[i]===sg&&Ae[i]>.02)vals.push([Ae[i],rel[i]]);if(!vals.length)continue;
    vals.sort((p,q)=>p[0]-q[0]);let tot=0;for(const v of vals)tot+=v[1];let acc=0,a0=vals[vals.length>>1][0];for(const v of vals){acc+=v[1];if(acc>=tot/2){a0=v[0];break}}
    const WA=new Float32Array(N),WW=new Float32Array(N);for(let i=0;i<N;i++)if(inner[i]&&grp[i]===sg&&Math.abs(Ae[i]-a0)<.3){WA[i]=rel[i]*Ae[i];WW[i]=rel[i]}
    const bA=blur(WA,rw,rh,1,14),bW=blur(WW,rw,rh,1,14),wref=sampleMedian(WW.filter(v=>v>0),.5)*.02;
    for(let i=0;i<N;i++){if(!hole[i]||grp[i]!==sg)continue;const loc=bW[i]>wref?bA[i]/bW[i]:a0,ac=loc>.94?1:loc;
      A[i]=inner[i]&&all[i]?ac:Math.min(Ae[i],ac);if(A[i]<.02)A[i]=0}}
  /* chế độ: "fill" vẽ lại toàn bộ nét đã dò; "auto" vẽ lại chỗ tính ngược không đáng tin (nền đoán lệch nhiều) */
  const mode=opt.mode||"auto";
  if(mode==="fill"){const fm=dilate(all,rw,rh,1);for(let i=0;i<N;i++)if(fm[i]){A[i]=1;for(let k=0;k<3;k++)Wc[i*3+k]=Wp[k]}}
  else if(mode==="auto"){
    /* tính ngược đáng tin khi kết quả nối liền với nền quanh nét; chỗ lệch rõ (vết loang) thì vẽ lại */
    const J=Float32Array.from(D);for(let i=0;i<N;i++){const a=A[i];if(a>0&&a<.95)for(let k=0;k<3;k++)J[i*3+k]=clamp((D[i*3+k]-a*Wc[i*3+k])/(1-a),0,255)}
    /* chỉ coi là hỏng khi phần lệch còn lại nằm theo đúng hướng màu watermark (còn sót, hoặc trừ quá tay);
       lệch theo hướng khác là vân nền thật, giữ nguyên */
    const bad=new Uint8Array(N);let nb=0;for(let i=0;i<N;i++){if(!(A[i]>0)||A[i]>=.95)continue;const s=grp[i]<0?-1:1;
      const e=s*((J[i*3]-B[i*3])*u[0]+(J[i*3+1]-B[i*3+1])*u[1]+(J[i*3+2]-B[i*3+2])*u[2]);
      if(Math.abs(e)>(14+3*sn)*(1+2*A[i])){bad[i]=1;nb++}}
    if(nb){const bd=dilate(bad,rw,rh,2);for(let i=0;i<N;i++)if(bd[i]&&(all[i]||A[i]>0)){A[i]=1;for(let k=0;k<3;k++)Wc[i*3+k]=Wp[k]}}}
  const u2=await unblend(D,rw,rh,A,Wc,opt);writeRGB(c,D,rx,ry,rw,rh);
  return{changed:true,found:cnt,box:[rx,ry,rw,rh],mask:all,how:u2.how};
}
/* mẫu cũ (danh sách khung chữ nhật theo tỉ lệ ảnh): dò nét trong từng khung thay vì xóa cả khung */
async function applyRects(c,rects,opt){
  const iw=c.width,ih=c.height,br=new Uint8Array(iw*ih);let any=false;
  for(const r of rects||[]){const x0=Math.max(0,Math.floor(r[0]*iw)),y0=Math.max(0,Math.floor(r[1]*ih)),x1=Math.min(iw,Math.ceil((r[0]+r[2])*iw)),y1=Math.min(ih,Math.ceil((r[1]+r[3])*ih));
    for(let y=y0;y<y1;y++){br.fill(1,y*iw+x0,y*iw+x1);any=true}}
  return any?removeBrush(c,br,opt):{changed:false};
}

/* =================== CẮT KHUNG 4:5 GIỮ TRỌN NGƯỜI MẪU ===================
   Nhận diện người bằng MediaPipe (EfficientDet-Lite0, Google, giấy phép Apache 2.0), chạy trong trình duyệt. */
const MP_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35";
const DET_MODEL=["https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite","/models/efficientdet_lite0.tflite"];
let DETP=null,DEToff=false;
function detector(){
  if(DEToff)return Promise.resolve(null);
  return DETP||(DETP=(async()=>{const mp=await import(MP_BASE+"/vision_bundle.mjs"),fs=await mp.FilesetResolver.forVisionTasks(MP_BASE+"/wasm");
    for(const u of DET_MODEL){try{return await mp.ObjectDetector.createFromOptions(fs,{baseOptions:{modelAssetPath:u,delegate:"CPU"},scoreThreshold:.3,maxResults:10,runningMode:"IMAGE",categoryAllowlist:["person"]})}catch(e){}}
    throw new Error("detector")})().catch(e=>{console.warn("FAIMG: person detector unavailable",e);DETP=null;DEToff=true;return null}));
}
/* các người trong ảnh: [{x,y,w,h,s}] theo điểm ảnh của src; null nếu không nhận diện được (không có mạng...) */
async function people(src){
  const d=await detector();if(!d)return null;
  try{const iw=src.naturalWidth||src.width,ih=src.naturalHeight||src.height,k=Math.min(1,1024/Math.max(iw,ih));let im=src;
    if(k<1)im=drawTo(src,Math.round(iw*k),Math.round(ih*k));
    return d.detect(im).detections.map(x=>({x:x.boundingBox.originX/k,y:x.boundingBox.originY/k,w:x.boundingBox.width/k,h:x.boundingBox.height/k,s:x.categories[0].score}))}
  catch(e){return null}
}
/* Kế hoạch cắt: lấy vùng [sx,sy,sw,sh] của ảnh, thêm nền pl/pr hai bên (cùng đơn vị điểm ảnh gốc) để đủ tỉ lệ.
   Thứ tự ưu tiên: không bao giờ cắt đầu; người toàn thân không vừa thì nới nền hai bên (tối đa maxPad bề ngang);
   vẫn không vừa mới cắt bớt phía chân. Người nhỏ thì phóng vào nhưng không phóng quá mức làm vỡ ảnh. */
function cropPlan(iw,ih,P,o){
  o=o||{};const RT=o.ratio||.8,MAXP=o.maxPad==null?.22:o.maxPad,outH=o.outH||1000;
  let ps=(P||[]).filter(p=>p.s>=.35&&p.w>=iw*.05&&p.h>=ih*.1);if(!ps.length)return null;
  const big=Math.max(...ps.map(p=>p.w*p.h));ps=ps.filter(p=>p.w*p.h>=big*.3);
  const plan=list=>{
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of list){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x+p.w);y1=Math.max(y1,p.y+p.h)}
    const bw=x1-x0,bh=y1-y0,cx0=Math.max(0,x0-.04*bw),cx1=Math.min(iw,x1+.04*bw),cy0=Math.max(0,y0-.07*bh),cy1=Math.min(ih,y1+.03*bh),nw=cx1-cx0,nh=cy1-cy0,pcx=(cx0+cx1)/2;
    /* khung nhỏ nhất được phép (không phóng to quá 1,25 lần so với ảnh ra) */
    const minH=Math.min(ih,iw/RT,outH/1.25);
    const fit=(H)=>{/* khung cao H, rộng H*RT nằm trong ảnh, chứa vùng người, đặt người giữa */
      const Wd=H*RT,sx=clamp(pcx-Wd/2,Math.max(0,cx1-Wd),Math.min(iw-Wd,cx0)),sy=clamp((cy0+cy1)/2-H/2,Math.max(0,cy1-H),Math.min(ih-H,cy0));
      return{sx:clamp(sx,0,iw-Wd),sy:clamp(sy,0,ih-H),sw:Wd,sh:H,pl:0,pr:0,cut:0}};
    const Hmax=Math.min(ih,iw/RT);
    if(nh<=Hmax&&nw<=Hmax*RT){/* vừa: phóng vào cho người chiếm khoảng 90% chiều cao */
      const H=clamp(Math.max(nh/.9,nw/RT,minH),Math.min(Hmax,Math.max(nh,nw/RT)),Hmax);return fit(H)}
    if(nh>Hmax&&iw/ih<=RT){/* ảnh cao, người cao hơn khung: nới nền hai bên */
      const needW=nh*RT;let totW=needW,H=nh,cut=0;
      if((needW-iw)/needW>MAXP){totW=iw/(1-MAXP);H=totW/RT;cut=nh-H}
      const L=clamp(totW/2-pcx,0,totW-iw);
      return{sx:0,sy:cy0,sw:iw,sh:H,pl:L,pr:totW-iw-L,cut}}
    return null};
  let r=plan(ps);
  if(!r&&ps.length>1){const one=ps.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0];r=plan([one])}
  if(!r){/* người rộng hơn khung (dang tay, nằm ngang): lấy giữa người, giữ đầu */
    const p=ps.sort((a,b)=>b.w*b.h-a.w*a.h)[0],H=Math.min(ih,iw/RT),Wd=H*RT;
    r={sx:clamp(p.x+p.w/2-Wd/2,0,iw-Wd),sy:clamp(p.y-.07*p.h,0,ih-H),sw:Wd,sh:H,pl:0,pr:0,cut:0}}
  r.persons=ps.length;return r;
}
/* Nới nền hai bên trên ảnh ra (canvas c): cột [0,a) và [b,W) đang trống. Có AI thì vẽ tiếp nền (ở nửa độ phân giải
   cho nhanh), không thì kéo dài mép ảnh và làm mờ dần. */
async function padSides(c,a,b,opt){
  const W=c.width,H=c.height,g=g2d(c);if(a<=0&&b>=W)return;
  /* 1. soi gương phần ảnh sát mép rồi làm mờ mạnh: trông như nền xóa phông của chính ảnh (dùng khi không có AI,
        và làm điểm khởi đầu cho AI) */
  const D=readRGB(c,0,0,W,H),M=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x<a||x>=b)M[y*W+x]=1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!M[y*W+x])continue;const xs=x<a?Math.min(b-1,2*a-x):Math.max(a,2*(b-1)-x);for(let k=0;k<3;k++)D[(y*W+x)*3+k]=D[(y*W+xs)*3+k]}
  {const Bl=blur(D,W,H,3,10);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!M[i])continue;const d=x<a?a-x:x-b+1,t=clamp(d/8,0,1);for(let k=0;k<3;k++)D[i*3+k]=t*Bl[i*3+k]+(1-t)*D[i*3+k]}}
  /* 2. AI vẽ tiếp nền ở nửa độ phân giải */
  if(!(opt&&opt.ai===false)){const w2=Math.round(W/2),h2=Math.round(H/2),s=cnv(W,H);writeRGB(s,D,0,0,W,H);const sm=drawTo(s,w2,h2),D2=readRGB(sm,0,0,w2,h2),M2=new Uint8Array(w2*h2);
    for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){const X=x*2+1;if(X<a+2||X>=b-2)M2[y*w2+x]=1}
    if(await aiFill(D2,w2,h2,M2)){writeRGB(sm,D2,0,0,w2,h2);const up=drawTo(sm,W,H),U=readRGB(up,0,0,W,H);
      /* hòa dần ở 6 điểm sát mép ảnh thật */
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!M[i])continue;const d=x<a?a-x:x-b+1,t=clamp(d/6,0,1);for(let k=0;k<3;k++)D[i*3+k]=t*U[i*3+k]+(1-t)*D[i*3+k]}}}
  /* xóa phông dần: càng xa ảnh thật càng mờ, để phần nền nới thêm không có chi tiết gì gây chú ý */
  if(!(opt&&opt.bokeh===false)){const Bl=blur(D,W,H,3,6),pw=Math.max(a,W-b,1);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!M[i])continue;const d=x<a?a-x:x-b+1,t=Math.pow(clamp(d/pw,0,1),.7)*.9;for(let k=0;k<3;k++)D[i*3+k]=(1-t)*D[i*3+k]+t*Bl[i*3+k]}}
  /* 3. rắc hạt nhẹ cho giống ảnh chụp */
  for(let i=0;i<W*H;i++)if(M[i]){const n=(rnd()-.5)*3;for(let k=0;k<3;k++)D[i*3+k]+=n}
  writeRGB(c,D,0,0,W,H,M);
}
/* Vẽ ảnh src vào canvas ra (OW×OH) theo kế hoạch cắt; trả về true nếu đã dùng kế hoạch (có người). */
async function drawPlan(src,out,plan,opt){
  const OW=out.width,OH=out.height,g=g2d(out),tot=plan.pl+plan.sw+plan.pr,k=OW/tot;
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";g.fillStyle="#fff";g.fillRect(0,0,OW,OH);
  const a=Math.round(plan.pl*k),b=Math.round((plan.pl+plan.sw)*k);
  g.drawImage(src,plan.sx,plan.sy,plan.sw,plan.sh,a,0,b-a,OH);
  if(a>0||b<OW)await padSides(out,a,b,opt);
}

/* =================== LƯU / ĐỌC MẪU (ảnh PNG: nửa trái = màu watermark, nửa phải = độ đục) =================== */
function tplToCanvas(T){
  const c=cnv(T.w*2,T.h),g=g2d(c),im=g.createImageData(T.w*2,T.h),d=im.data;
  for(let y=0;y<T.h;y++)for(let x=0;x<T.w;x++){const i=y*T.w+x,p=(y*T.w*2+x)*4,q=(y*T.w*2+T.w+x)*4,a=Math.round(clamp(T.a[i],0,1)*255);
    d[p]=T.W[i*3];d[p+1]=T.W[i*3+1];d[p+2]=T.W[i*3+2];d[p+3]=255;d[q]=d[q+1]=d[q+2]=a;d[q+3]=255}
  g.putImageData(im,0,0);return c;
}
function tplFromImage(img,meta){
  const w=meta.w,h=meta.h,c=cnv(w*2,h);g2d(c).drawImage(img,0,0);const d=g2d(c).getImageData(0,0,w*2,h).data,a=new Float32Array(w*h),W=new Float32Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,p=(y*w*2+x)*4,q=(y*w*2+w+x)*4;a[i]=d[q]/255;W[i*3]=d[p];W[i*3+1]=d[p+1];W[i*3+2]=d[p+2]}
  return{v:2,rw:meta.rw,rh:meta.rh,x:meta.x,y:meta.y,w,h,a,W};
}
/* ảnh xem trước: mẫu tô đỏ đè lên ảnh, độ đậm theo độ đục từng điểm */
function overlayPreview(c,T){
  const iw=c.width,ih=c.height,tf=placement(T,iw,ih),bx=Math.max(0,Math.floor(T.x*tf.sx)),by=Math.max(0,Math.floor(T.y*tf.sy)),bw=Math.min(iw,Math.ceil((T.x+T.w)*tf.sx))-bx,bh=Math.min(ih,Math.ceil((T.y+T.h)*tf.sy))-by;
  if(bw<1||bh<1)return;const Wp=warp(T,tf,bx,by,bw,bh),g=g2d(c),im=g.getImageData(bx,by,bw,bh),d=im.data;
  for(let i=0;i<bw*bh;i++){const a=Math.min(1,Wp.A[i]*1.6);if(a<=0)continue;d[i*4]=d[i*4]*(1-a)+235*a;d[i*4+1]=d[i*4+1]*(1-a)+40*a;d[i*4+2]=d[i*4+2]*(1-a)+70*a}
  g.putImageData(im,bx,by);
}

window.FAIMG={tileDbg:()=>TILEDBG,learnTemplate,applyTemplate,removeBrush,applyRects,people,cropPlan,drawPlan,padSides,detector,tplToCanvas,tplFromImage,overlayPreview,unblend,complete,fillHole,aiFill,aiSession,harmonicFill,decode,readRGB,writeRGB,drawTo,edt,dilate,erode,comps,blur,hpStats,fitMatte,learnRegion,warp,placement,presence,pack,_cnv:cnv};
})();
