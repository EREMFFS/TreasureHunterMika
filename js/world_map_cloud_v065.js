// v065: ワールドマップの未到達地域を、雲画像で覆う。公開条件はv061のまま。
(function(){
'use strict';
const M=window.MIKA,cache=new WeakMap();
function draw(ctx,region){
 const image=M.bg('map_cloud_v065');if(!image)return;
 let layer=cache.get(region);
 if(!layer){
  layer=document.createElement('canvas');layer.width=384;layer.height=216;
  const c=layer.getContext('2d');c.imageSmoothingEnabled=false;
  const p=region.polygon,xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
  const x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;
  const path=()=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
  // 中心は完全に不透明。テクスチャの透過部分から地形を透かさない。
  c.save();path();c.clip();c.fillStyle='#edf3f5';c.fillRect(x0,y0,w,h);
  c.drawImage(image,x0-20,y0-15,w+40,h+30);
  c.restore();
  // 輪郭は四角のブロックではなく本物の雲の丸い縁。
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/25);
   for(let j=0;j<n;j++){
    const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;
    const wd=48+((i+j)%3)*4,ht=wd*.72;
    c.drawImage(image,Math.round(x-wd/2),Math.round(y-ht/2),wd,Math.round(ht));
   }
  }
  cache.set(region,layer);
 }
 ctx.save();ctx.globalAlpha=1;ctx.drawImage(layer,0,0);ctx.restore();
}
M.WorldMapCloudV065={draw};
})();
