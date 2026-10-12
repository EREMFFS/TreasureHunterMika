// 任意: 既存の落下位置へ瓦礫を1個描くだけ。落下・ダメージ・判定は変更しない。
(function(){const M=window.MIKA;
M.drawEscapeRubbleV070=function(index,x,y,options={}){
 const item=M.ESCAPE_RUBBLE_V070.items[index];if(!item)return;
 const size=options.size===24?24:16,spec=item.sizes[size],im=M.bg(spec.assetId);if(!im)return;
 const c=M.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.rotate(options.angle??0);
 const scale=options.scale??1;c.scale(scale,scale);c.globalAlpha*=options.alpha??1;
 c.drawImage(im,-spec.pivot[0],-spec.pivot[1]);c.restore();
};})();
