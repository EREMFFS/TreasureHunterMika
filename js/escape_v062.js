// v062: 6B〜6E の予告ひび + 脱出後の遠景ビル崩壊。既存 Ending の時計は変更しない。
(function () {
'use strict';
const M=window.MIKA, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function holePoint(w) {
 const stuck=!!(w.map.escort||{}).stuck;
 return {x:stuck?(w.rtl?118:w.width-118):(w.rtl?280:w.width-280),y:w.walkY[0]+10};
}
const crackLines=[[[0,0],[-7,-2],[-14,-1],[-21,-5],[-29,-4]],[[0,0],[8,-3],[14,-2],[19,-6],[27,-7]],[[0,0],[6,3],[14,4],[19,8],[27,9]],[[0,0],[-6,3],[-11,7],[-19,6],[-25,10]],[[-14,-1],[-16,-5],[-21,-7]],[[14,4],[17,1],[23,1]],[[0,0],[1,-4],[-2,-8]]];
function drawCrack(w) {
 if(!['6B','6C','6D','6E'].includes(w.mapId))return;
 if(w.s6&&w.s6.hole&&w.s6.hole.hit)return;
 const p=holePoint(w),x=Math.round(p.x-w.camX),y=Math.round(p.y);
 if(x < -40 || x > M.W+40)return;
 const c=M.ctx;c.save();c.lineWidth=1;c.lineJoin='miter';c.lineCap='square';
 for(const [color,offset] of [['#c8bfa9',1],['#292432',0]]){
  c.strokeStyle=color;for(const line of crackLines){c.beginPath();line.forEach(([dx,dy],i)=>i?c.lineTo(x+dx,y+dy+offset):c.moveTo(x+dx,y+dy+offset));c.stroke();}
 }
 c.restore();
}
// 決まった時刻の爆発。低フレームレートでも同じ進行・同じ粒子位置。
const blasts=[{t:2.6,x:189,y:120,r:27},{t:3.25,x:174,y:75,r:31},{t:3.9,x:201,y:46,r:33},{t:4.5,x:196,y:143,r:47},{t:5.15,x:182,y:99,r:61},{t:6.1,x:196,y:156,r:48}];
class BuildingCollapse {
 constructor(next,oldWorld) {
  this.next=next;this.t=0;this.done=false;this.cue=0;
  M.Audio.stopMusic();
  if(oldWorld&&oldWorld.sirenV)M.Audio.stopLoop(oldWorld.sirenV);
 }
 update(dt){
  if(this.done)return;this.t+=dt/1000;
  // 2026-10-12 ユーザー指定: 音はボス撃破と同じ使い方（爆発音＋断末魔の boom を連打 → 最後の爆発で大爆発の音）
  const first=blasts[0].t,last=blasts[blasts.length-1].t;
  if(this.t>=first&&this.t<last&&(this.boomT=(this.boomT||0)-dt)<=0){this.boomT=150+Math.random()*120;M.Audio.play('explosion');M.bossDeathVoice(false);}
  while(this.cue<blasts.length&&this.t>=blasts[this.cue].t){
   if(this.cue===blasts.length-1){M.Audio.play('explosion');M.Audio.play('explosion',{rate:.7});M.Audio.play('hit_heavy');M.bossDeathVoice(true);}
   else M.Audio.play('explosion',{gain:this.cue===4?1:.8});
   this.cue++;}
  if(this.t>=14.7){this.done=true;this.next();}
 }
 draw(){drawCollapse(M.ctx,this.t);}
}
function drawCollapse(c,t){
 c.save();c.imageSmoothingEnabled=false;c.fillStyle='#030711';c.fillRect(0,0,384,216);
 const city=M.bg('end_city');if(city)c.drawImage(city,0,0,city.width,city.height,0,0,384,216);
 const shake=t>=2.6&&t<8?Math.sin(t*54)*1.8*(1-clamp((t-5)/3,0,1)):0;
 c.save();c.translate(Math.round(shake),Math.round(shake*.45));
 // アセットのビルを分割して飛ばす。上部から裂け、最後に足元まで砕ける。
 const tower=M.bg('collapse_tower_v062');
 if(tower){const cols=8,rows=14,wd=96,ht=166;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const seed=row*cols+col,delay=3.8+row*.12+(seed%5)*.065,age=Math.max(0,t-delay);
   const vx=(col-3.5)*10+Math.sin(seed*2.31)*29,vy=-40-(seed%7)*9;
   const x=144+col*wd/cols+vx*age,y=12+row*ht/rows+vy*age+22*age*age;
   if(age>4.7)continue;c.save();c.globalAlpha=1-clamp((age-3.7),0,1);
   c.translate(x+6,y+6);c.rotate(age*Math.sin(seed)*1.3);
   c.drawImage(tower,col*tower.width/cols,row*tower.height/rows,tower.width/cols,tower.height/rows,-6,-6,wd/cols,ht/rows);c.restore();
  }
 }
 // 火球: 白熱の中心→黄金→橙→赤黒い煙。画面全体の震動はここだけ。
 for(const b of blasts){const age=t-b.t;if(age<0||age>5)continue;
  const fx=M.bg('collapse_blast_v062');
  if(fx){const frame=age<.12?0:age<.3?1:age<.65?2:age<1.4?3:age<2.4?4:5;
   const size=b.r*3*(.75+Math.min(age,.6)*.4);
   c.save();c.globalAlpha=1-clamp((age-3)/2,0,1);
   c.drawImage(fx,frame*128,0,128,128,b.x-size/2,b.y-size/2-age*10,size,size);c.restore();
  }else{
  if(age<1.8){const r=b.r*(.15+Math.sin(clamp(age/1.8,0,1)*Math.PI*.75));
   for(let j=7;j>=0;j--){const angle=j*2.4,rr=r*(.35+(j%3)*.12),x=b.x+Math.cos(angle)*r*.45,y=b.y+Math.sin(angle)*r*.28-age*11;
    for(const [k,color] of [[1,'#7e251d'],[.82,'#ee5c20'],[.58,'#ffb841'],[.30,'#fff5c0']]){c.fillStyle=color;c.beginPath();c.arc(x,y,rr*k,0,Math.PI*2);c.fill();}
   }
  }
  if(age>.6){c.save();c.globalAlpha=Math.min(.85,(age-.6)/.7)*(1-clamp((age-3.2)/1.8,0,1));
   for(let j=0;j<9;j++){c.fillStyle=j%2?'#393642':'#24252e';c.beginPath();c.arc(b.x+Math.sin(j*2.4)*b.r*(.2+age*.11),b.y-age*15-j*3,9+age*5+(j%3)*3,0,Math.PI*2);c.fill();}c.restore();}
  }
  if(age<1.2){c.save();c.globalAlpha=(1-age/1.2)*.65;c.strokeStyle='#ffe4a0';c.lineWidth=2;c.beginPath();c.ellipse(b.x,b.y,age*110+5,age*42+3,0,0,Math.PI*2);c.stroke();c.restore();}
 }
 for(let i=0;i<65;i++){const age=t-4.2-(i%6)*.18;if(age<0||age>5.5)continue;const x=192+Math.cos(i*2.399)*(25+i%8*7)*age,y=108+Math.sin(i*2.399)*48*age+16*age*age;c.fillStyle=i%3?'#ffb34b':'#fff5c8';c.fillRect(Math.round(x),Math.round(y),i%3===0?2:1,2);}
 c.restore();
 const flash=blasts.reduce((a,b)=>Math.max(a,clamp(1-(t-b.t)/.16,0,1)*(t>=b.t?.35:0)),0);
 if(flash){c.fillStyle=`rgba(255,235,190,${flash})`;c.fillRect(0,0,384,216);}
 const fade=t<1?1-t:t>=11?clamp((t-11)/3,0,1):0;
 if(fade){c.fillStyle=`rgba(0,0,0,${fade})`;c.fillRect(0,0,384,216);}c.restore();
}
M.EscapeV062={holePoint,drawCrack,BuildingCollapse,drawCollapse,duration:14.7};
})();
