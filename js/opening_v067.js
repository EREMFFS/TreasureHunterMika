// v067: ロードクレジット→無音オープニング→既存タイトル。ゲーム進行や音声は変更しない。
(function(){
'use strict';const M=window.MIKA;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const CUES={creditFade:.8,room:10.5,letter:5.5,resolve:5.2,fade:1.4};
const TOTAL=CUES.room+CUES.letter+CUES.resolve;
function fitImage(key,x,y,w,h){const im=M.bg(key);if(im)M.ctx.drawImage(im,x,y,w,h);}
function sprite(key,x,y,w,h,flip=false){const c=M.ctx,im=M.bg(key);if(!im)return;c.save();c.translate(Math.round(x),Math.round(y));if(flip){c.scale(-1,1);c.drawImage(im,-w,0,w,h);}else c.drawImage(im,0,0,w,h);c.restore();}
class Opening {
 constructor(next,loader,opts){
  this.next=next;this.loader=loader;this.phase='wait';this.t=0;this.done=false;this.skipT=null;
  const demoOnly=!!(opts&&opts.demoOnly);   // v125 タイトルから戻ってくるデモ（社名・キー待ちなし）
  // 2026-10-12 v121: 読み込みが終わったら社名のまま「PRESS ANY KEY」で1回キーを待つ。ブラウザは最初の操作の前に音を出させないので、
  //   ここで押してもらって音を使える状態にしてから（ピッピッ）オープニング → タイトルの曲が確実に鳴る
  const now=loader&&loader.querySelector('.loading-now');if(now){now.textContent='PRESS ANY KEY';now.classList.add('ready');}
  if(demoOnly){this.phase='demo';this.t=0;}
  this.start=()=>{if(this.phase!=='wait')return;M.Audio.unlock();M.Audio.pipPip();const n=this.loader&&this.loader.querySelector('.loading-now');if(n)n.remove();this.phase='creditFade';this.t=0;};
  // 全キー/クリック/ゲームパッドのスキップ。入力は次のタイトルへ持ち越さない。
  this.key=e=>{if(e.repeat)return;if(this.phase==='wait'){this.start();return;}if(this.phase==='demo'){if(e.preventDefault)e.preventDefault();this.skip();}};
  this.pointer=()=>{if(this.phase==='wait'){this.start();return;}if(this.phase==='demo')this.skip();};
  window.addEventListener('keydown',this.key,true);window.addEventListener('pointerdown',this.pointer);
  M.Audio.stopMusic();this.padBlocked=true;
 }
 skip(){if(this.skipT==null)this.skipT=0;}
 clearInput(){const I=M.Input;if(!I)return;for(const group of ['pressed','released'])for(const k in I[group]||{})I[group][k]=false;I.anyPressed=false;}
 finish(){if(this.done)return;this.done=true;window.removeEventListener('keydown',this.key,true);window.removeEventListener('pointerdown',this.pointer);this.clearInput();this.next();}
 update(dt){
  if(this.done)return;const s=dt/1000;
  if(this.phase==='wait'){if(typeof navigator!=='undefined'&&navigator.getGamepads&&Array.from(navigator.getGamepads()).some(p=>p&&p.buttons.some(b=>b.pressed)))this.start();this.clearInput();return;}
  if(this.phase==='creditFade'){
   this.t+=s;const credit=this.loader&&this.loader.querySelector('.loading-credit');if(credit)credit.style.opacity=String(1-clamp(this.t/CUES.creditFade));
   if(this.t>=CUES.creditFade){if(this.loader)this.loader.remove();this.loader=null;this.phase='demo';this.t=0;this.clearInput();}return;
  }
  this.t+=s;
  const I=M.Input||{};let pad=false;
  if(typeof navigator!=='undefined'&&navigator.getGamepads)pad=Array.from(navigator.getGamepads()).some(p=>p&&p.buttons.some(b=>b.pressed));
  if(!pad)this.padBlocked=false;
  if(this.t>.25&&((I.anyPressed)||(!this.padBlocked&&pad)))this.skip();
  if(this.skipT!=null){this.skipT+=s;if(this.skipT>=.65)this.finish();}
  else if(this.t>=TOTAL+CUES.fade)this.finish();
 }
 draw(){
  const c=M.ctx;c.save();c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,384,216);
  if(this.phase==='wait'){c.restore();return;}   // v121 社名とPRESS ANY KEYはロード画面（DOM）のまま
  if(this.phase==='creditFade'){if(!this.loader){c.globalAlpha=1-clamp(this.t/CUES.creditFade);M.text('LONKA CORPORATE PRESENTS',192,103,{align:'center',color:'#fff'});}c.restore();return;}
  drawDemo(this.t);
  // 控えめなスキップ案内。デモの演技は文字で説明しない。
  if(this.t>.9&&this.t<TOTAL&&Math.floor(this.t*1.5)%2===0)M.text('PRESS ANY KEY',378,205,{align:'right',color:'#d5d8dc'});
  const fade=this.skipT!=null?clamp(this.skipT/.65):clamp((this.t-TOTAL)/CUES.fade);
  if(fade){c.fillStyle=`rgba(0,0,0,${fade})`;c.fillRect(0,0,384,216);}c.restore();
 }
}
function drawDemo(t){
 const c=M.ctx;
 if(t<CUES.room){
  fitImage('op_room_v067',0,0,384,216);
  // 始めはぼんやり座る。ロボは右の入口から封筒を抱えて走り込む。
  const receiving=t>=5.8&&t<7.4,reading=t>=7.4;
  sprite(reading?'op_read_v067':receiving?'op_receive_v067':'op_sit_v067',89,98,96,96);
  const p=clamp((t-2.7)/2.7),x=402-(402-182)*p;
  if(t>=2.7){if(t<6.8)sprite('op_robot_letter_v067',x,129+Math.sin(t*30)*.4*(1-p),64,64);
   else M.drawAnim('robot_idle',Math.floor(t*5)%M.ANIMS.robot_idle.frames.length,211,178,false);}
  // 封筒は差し出す手からミカの手へ移る。
  if(t>=6.2&&t<7.3){const q=clamp((t-6.2)/1.1),xx=195-34*q,yy=146-10*q;c.fillStyle='#f7ead5';c.fillRect(Math.round(xx),Math.round(yy),12,8);c.strokeStyle='#8b7258';c.strokeRect(Math.round(xx),Math.round(yy),12,8);c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+6,yy+4);c.lineTo(xx+12,yy);c.stroke();}
  if(t<.9){c.fillStyle=`rgba(0,0,0,${1-t/.9})`;c.fillRect(0,0,384,216);}
  if(t>10.15){c.fillStyle=`rgba(0,0,0,${clamp((t-10.15)/.35)})`;c.fillRect(0,0,384,216);}
 }else if(t<CUES.room+CUES.letter){
  const pt=t-CUES.room,scale=1+clamp(pt/5.5)*.045;
  fitImage('op_letter_closeup_v067',192-192*scale,108-108*scale,384*scale,216*scale);
  if(pt<.35){c.fillStyle=`rgba(0,0,0,${1-pt/.35})`;c.fillRect(0,0,384,216);}
  if(pt>5.15){c.fillStyle=`rgba(0,0,0,${clamp((pt-5.15)/.35)})`;c.fillRect(0,0,384,216);}
 }else{
  const pt=t-CUES.room-CUES.letter;
  fitImage('op_room_v067',0,0,384,216);
  sprite('op_empty_chair_v067',112,129,48,48);
  if(pt<1.7){sprite('op_determined_v067',89,98,96,96);M.drawAnim('robot_idle',Math.floor(t*5)%M.ANIMS.robot_idle.frames.length,211,178,false);}
  else if(pt<2.3){
   const q=clamp((pt-1.7)/.6);sprite('op_determined_v067',89+q*118,98,96,96);M.drawAnim('robot_idle',0,211,178,false);
  }else{
   const x=161+Math.pow(pt-2.3,1.13)*113;
   sprite(Math.floor((pt-2.3)*8)%2?'op_pull_b_v067':'op_pull_a_v067',x,99-22*clamp((pt-2.3)/.9)+Math.sin((pt-2.3)*16)*1.2,128,96);
  }
  if(pt<.35){c.fillStyle=`rgba(0,0,0,${1-pt/.35})`;c.fillRect(0,0,384,216);}
 }
}
function preloadAudio(){
 M.Audio.preload();if(!M.Audio.ctx)return Promise.resolve();
 const A=M.AUDIO,jobs=[];
 for(const k in A.se)if(A.se[k])jobs.push(M.Audio.load('se:'+k,A.se[k]));
 for(const k in A.voice||{})for(const [i,f] of A.voice[k].files.entries())jobs.push(M.Audio.load('vo:'+k+':'+i,f));
 for(const k in A.music)if(A.music[k])jobs.push(M.Audio.load(k,A.music[k]));
 return Promise.allSettled(jobs);
}
M.OpeningV067={Opening,drawDemo,preloadAudio,cues:CUES,duration:TOTAL+CUES.fade};
})();
