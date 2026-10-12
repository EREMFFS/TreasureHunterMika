// v068: タイトル右下CONFIG / W。7操作のキーボード設定を保存。
(function(){
'use strict';const M=window.MIKA,I=M.Input,STORE='treasureHunterMika.keys.v1';
const rows=[['attack','ATTACK'],['jump','JUMP'],['up','MOVE UP'],['down','MOVE DOWN'],['left','MOVE LEFT'],['right','MOVE RIGHT'],['pause','PAUSE']];
const defaults=Object.fromEntries(rows.map(([key])=>[key,M.TUNING.keys[key].slice()]));
const clone=x=>Object.fromEntries(rows.map(([key])=>[key,x[key].slice()]));
const reserved=new Set(['Enter','Space','Escape','Tab','MetaLeft','MetaRight']);
const validCode=code=>typeof code==='string'&&(code==='Escape'||/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal|Enter)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Minus|Equal|Backquote|Backspace|CapsLock)$/.test(code));
function validate(value){
 if(!value||typeof value!=='object')return false;const seen=new Set(M.TUNING.keys.start);
 for(const [key] of rows){const codes=value[key];if(!Array.isArray(codes)||codes.length<1||codes.length>4)return false;
  for(const code of codes){if(!validCode(code)||(reserved.has(code)&&!(key==='pause'&&code==='Escape'))||seen.has(code))return false;seen.add(code);}}
 return true;
}
let keys=clone(defaults),persistent=true;
try{const value=JSON.parse(localStorage.getItem(STORE)||'null');if(validate(value))keys=clone(value);}catch(e){/* 無効な保存内容は既定値を使用 */}
I.setKeyBindings(keys);
function updateHint(){
 if(typeof document==='undefined'||!document.getElementById)return;
 const hint=document.getElementById('hint');if(!hint)return;
 hint.textContent='画面をクリックしてから操作　移動 '+keys.up.map(name).join('/')+'/'+keys.down.map(name).join('/')+'/'+keys.left.map(name).join('/')+'/'+keys.right.map(name).join('/')+'・攻撃 '+keys.attack.map(name).join('/')+'・ジャンプ '+keys.jump.map(name).join('/')+'・Enterスタート・ポーズ '+keys.pause.map(name).join('/')+'・F3ブラウン管ON/OFF';
}
function persist(){updateHint();try{localStorage.setItem(STORE,JSON.stringify(keys));persistent=true;}catch(e){persistent=false;}return persistent;}
function name(code){const aliases={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT',Escape:'ESC',Space:'SPACE',ShiftLeft:'L SHIFT',ShiftRight:'R SHIFT',ControlLeft:'L CTRL',ControlRight:'R CTRL',AltLeft:'L ALT',AltRight:'R ALT',Backspace:'BACKSPACE',CapsLock:'CAPS LOCK',NumpadEnter:'NUM ENTER',BracketLeft:'[',BracketRight:']',Backslash:'BACKSLASH',Semicolon:';',Quote:'QUOTE',Comma:',',Period:'.',Slash:'/',Minus:'-',Equal:'=',Backquote:'`'};return aliases[code]||code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'NUM ');}
let openRequest=null;const blocked=new Set();
const titleButton={x:282,y:194,w:96,h:18};
function titleEligible(scene){return M.Title&&scene instanceof M.Title&&!scene.leaving&&scene.t>300&&scene.fade.a<.1;}
function stop(e){if(e.preventDefault)e.preventDefault();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}
function setBinding(action,code){
 if(!rows.some(([key])=>key===action))return {ok:false,message:'INVALID ACTION'};
 if(!validCode(code)||reserved.has(code))return {ok:false,message:'THIS KEY IS RESERVED'};
 for(const key in M.TUNING.keys)if(key!==action&&M.TUNING.keys[key].includes(code))return {ok:false,message:'KEY ALREADY USED'};
 keys[action]=[code];I.setKeyBindings(keys);persist();return {ok:true,message:persistent?'SAVED':'SAVED FOR THIS SESSION'};
}
function reset(){keys=clone(defaults);I.setKeyBindings(keys);persist();}
class Config {
 constructor(title){this.title=title;this.selected=0;this.waiting=false;this.message='';this.messageT=0;this.done=false;I.clearHeld();}
 update(dt){
  this.messageT=Math.max(0,this.messageT-dt);if(this.done)return;
  if(this.waiting){if(I.pressed.jump){this.waiting=false;this.message='CANCELLED';this.messageT=1000;}return;}
  if(I.pressed.up)this.selected=(this.selected+8)%9;
  if(I.pressed.down)this.selected=(this.selected+1)%9;
  if(I.pressed.start||I.pressed.attack)this.choose();
  else if(I.pressed.jump)this.close();
 }
 choose(){if(this.selected<7){this.waiting=true;this.message='';}else if(this.selected===7){reset();this.message='DEFAULTS RESTORED';this.messageT=1800;}else this.close();}
 key(e){
  if(this.waiting){if(e.code==='Escape'){this.waiting=false;this.message='CANCELLED';this.messageT=1000;return;}
   const result=setBinding(rows[this.selected][0],e.code);this.message=result.message;this.messageT=1800;if(result.ok){this.waiting=false;blocked.add(e.code);}return;
  }
  if(e.code==='ArrowUp')this.selected=(this.selected+8)%9;
  else if(e.code==='ArrowDown')this.selected=(this.selected+1)%9;
  else if(e.code==='ArrowLeft'||e.code==='ArrowRight'){if(this.selected>=7)this.selected=this.selected===7?8:7;}
  else if(e.code==='Enter'){this.choose();if(this.done)blocked.add(e.code);}
  else if(e.code==='Escape'){this.close();blocked.add(e.code);}
 }
 close(){if(this.done)return;this.done=true;I.clearHeld();M.setScene(this.title);}
 click(x,y){if(this.waiting)return;for(let i=0;i<7;i++)if(x>=24&&x<=360&&y>=45+i*17&&y<62+i*17){this.selected=i;this.choose();return;}
  if(y>=170&&y<=188){if(x>=24&&x<=182){this.selected=7;this.choose();}else if(x>=202&&x<=360){this.selected=8;this.choose();}}
 }
 draw(){
  const c=M.ctx;c.save();c.fillStyle='#071019';c.fillRect(0,0,384,216);
  M.text('CONFIG',192,12,{scale:2,align:'center',color:'#f1f5f7'});
  M.text('KEY SETUP',192,33,{align:'center',color:'#8197a9'});
  for(let i=0;i<7;i++){const [key,label]=rows[i],y=49+i*17,selected=this.selected===i;
   if(selected){c.fillStyle=this.waiting?'#463617':'#172f40';c.fillRect(24,y-4,336,16);}
   M.text(label,34,y,{color:selected?'#fff':'#b2c0ca'});
   const text=this.waiting&&selected?'PRESS A KEY':keys[key].map(name).join(' / ');
   M.text(text,348,y,{align:'right',color:this.waiting&&selected?'#ffd67b':'#94d2ed'});
  }
  for(const [index,label,x,w] of [[7,'DEFAULT',24,158],[8,'BACK',202,158]]){c.fillStyle=this.selected===index?'#24445a':'#102333';c.fillRect(x,170,w,18);M.text(label,x+w/2,175,{align:'center',color:'#e7eff4'});}
  if(this.messageT>0)M.text(this.message,192,192,{align:'center',color:this.message.includes('USED')||this.message.includes('RESERVED')?'#ffb38f':'#9bcbb5'});
  else M.text(this.waiting?'ESC: CANCEL':'ARROWS: SELECT  ENTER: CHANGE',192,192,{align:'center',color:'#8197a9'});
  M.text('CLICK OK   ESC: BACK',192,205,{align:'center',color:'#657f93'});c.restore();
 }
}
window.addEventListener('keydown',e=>{
 if(blocked.has(e.code)){stop(e);return;}
 const scene=M.game&&M.game.scene;
 if(scene instanceof Config){stop(e);if(!e.repeat)scene.key(e);return;}
 if(e.code==='KeyW'&&titleEligible(scene)){stop(e);if(!e.repeat)openRequest=scene;}
},true);
window.addEventListener('keyup',e=>{if(blocked.delete(e.code)||M.game&&M.game.scene instanceof Config)stop(e);},true);
window.addEventListener('blur',()=>blocked.clear());
window.addEventListener('pointerdown',e=>{
 const scene=M.game&&M.game.scene;if(!(scene instanceof Config)&&!titleEligible(scene))return;
 const surface=M.CRT&&M.CRT.on?M.CRT.view:M.canvas;if(!surface||e.target!==surface)return;
 const box=surface.getBoundingClientRect();if(!box.width||!box.height)return;
 const x=(e.clientX-box.left)*384/box.width,y=(e.clientY-box.top)*216/box.height;
 if(M.Audio&&M.Audio.unlock)M.Audio.unlock();
 if(scene instanceof Config){stop(e);scene.click(x,y);}else if(x>=titleButton.x&&x<=titleButton.x+titleButton.w&&y>=titleButton.y&&y<=titleButton.y+titleButton.h){stop(e);openRequest=scene;}
},true);
M.KeyConfig={
 Config,validate,setBinding,reset,name,pauseLabel:()=>keys.pause.map(name).join(' / '),getBindings:()=>clone(keys),defaults:clone(defaults),
 consumeOpen(title){if(openRequest!==title)return false;openRequest=null;I.clearHeld();M.setScene(new Config(title));return true;},
 drawTitleButton(){const c=M.ctx;c.save();c.fillStyle='#07111ce6';c.fillRect(titleButton.x,titleButton.y,titleButton.w,titleButton.h);c.strokeStyle='#8babb7';c.strokeRect(titleButton.x+.5,titleButton.y+.5,titleButton.w-1,titleButton.h-1);M.text('CONFIG [W]',330,199,{align:'center',color:'#e8f4fb'});c.restore();}
};
updateHint();
})();
