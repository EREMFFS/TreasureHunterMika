// 任意: 既存の演出から一文字を描く。登場順・タイミングは実装側で制御。
(function(){
 const M=window.MIKA;
 M.drawBossLogoGlyphV069=function(boss,line,index,x,y,options={}){
  const spec=M.BOSS_LOGO_GLYPHS_V069.bosses[boss];
  const item=spec&&spec.lines[line]&&spec.lines[line].glyphs[index];if(!item)return;
  const im=M.bg(item.assetId);if(!im)return;
  const c=M.ctx,scale=options.scale??1;
  c.save();c.translate(Math.round(x),Math.round(y));c.rotate(options.angle??0);c.scale(scale,scale);
  c.globalAlpha*=Math.max(0,Math.min(1,options.alpha??1));
  c.drawImage(im,-item.pivot[0],-item.pivot[1]);c.restore();
 };
})();
