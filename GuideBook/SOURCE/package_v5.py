from pathlib import Path
import json, shutil, zipfile
from PIL import Image, ImageDraw
root=Path('/workspace/scratch/265e83887296/guide/output_v005')
for p in sorted((root/'pages').glob('page-*.png')):Image.open(p).convert('RGB').save(p.with_suffix('.jpg'),quality=82,subsampling=2)
titles=json.loads((root/'page_titles.json').read_text())
html='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ミカ ウル秘テクニカルブック</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#172d45;color:#fff9e9;font-family:system-ui,sans-serif}header{background:#102236;position:sticky;top:0;z-index:2;padding:12px 16px;border-bottom:3px solid #e7af3c}h1{font-size:17px;margin:0 0 10px}nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center}button,select,a{font:inherit}button,select{border:0;border-radius:5px;padding:9px;background:#fff9e9;color:#172d45}button{cursor:pointer}button:disabled{opacity:.4}select{max-width:100%;flex:1;min-width:160px}a{color:#ffd16c;font-size:13px}main{padding:18px;min-height:70vh}figure{margin:0 auto;max-width:840px}img{display:block;width:100%;height:auto;box-shadow:0 8px 30px #0006}figcaption{padding:12px 0;text-align:center;font-size:14px}footer{text-align:center;padding:18px;font-size:12px;color:#cdd1d4}#shelf{display:none;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;max-width:1200px;margin:auto}#shelf button{padding:5px;background:#fff9e9}#shelf small{display:block;margin-top:6px}body.overview figure{display:none}body.overview #shelf{display:grid}
</style><header><h1>トレジャーハンターミカ／ゴブリン族の秘宝 ウル秘テクニカルブック</h1><nav><button id="prev">← 前</button><select id="pick" aria-label="ページを選ぶ"></select><button id="next">次 →</button><button id="all">目次一覧</button></nav></header><main><figure><img id="page" alt=""><figcaption id="caption"></figcaption></figure><div id="shelf"></div></main><footer>全62ページ・← → キーでも移動。ドクターSの撃破後は秘密！／v005</footer><script>
const titles=__TITLES__;const pick=document.getElementById('pick'),im=document.getElementById('page'),caption=document.getElementById('caption'),shelf=document.getElementById('shelf');let n=0;
function src(i){return 'pages/page-'+String(i+1).padStart(2,'0')+'.jpg'}
titles.forEach((t,i)=>{let op=document.createElement('option');op.value=i;op.textContent=String(i+1).padStart(2,'0')+' '+t;pick.append(op);let b=document.createElement('button');let img=document.createElement('img');img.src=src(i);img.alt=t;img.loading='lazy';let s=document.createElement('small');s.textContent=(i+1)+' '+t;b.append(img,s);b.onclick=()=>{document.body.classList.remove('overview');show(i)};shelf.append(b)});
function show(i){n=Math.max(0,Math.min(titles.length-1,i));pick.value=n;im.src=src(n);im.alt=(n+1)+'ページ '+titles[n];caption.textContent=(n+1)+' / '+titles.length+'　'+titles[n];document.getElementById('prev').disabled=n===0;document.getElementById('next').disabled=n===titles.length-1}
document.getElementById('prev').onclick=()=>show(n-1);document.getElementById('next').onclick=()=>show(n+1);pick.onchange=()=>{document.body.classList.remove('overview');show(Number(pick.value))};document.getElementById('all').onclick=()=>document.body.classList.toggle('overview');document.addEventListener('keydown',e=>{if(e.target.tagName==='SELECT')return;if(e.key==='ArrowRight'){e.preventDefault();show(n+1)}if(e.key==='ArrowLeft'){e.preventDefault();show(n-1)}});show(0);
</script></html>'''.replace('__TITLES__',json.dumps(titles,ensure_ascii=False))
(root/'READ_BOOK.html').write_text(html)
(root/'README.txt').write_text('トレジャーハンターミカ ウル秘テクニカルブック v005\n\n全62ページ。\n・PDF：MIKA_ADVENTURE_GUIDE_v005.pdf（別途ダウンロード。目次のしおり付き）\n・1ページずつの画像：pages/page-01.jpg ～ page-36.jpg\n・ページをめくって読む：このZIPを展開し、READ_BOOK.htmlを開く\n・文章の改訂用：MIKA_GUIDE_TEXT.txt\n\n攻略は展望台のドクターS戦まで。撃破後の物語・6面・エンディングは掲載していません。\n根拠：受領した完成版game(2).zipの実装・データ。新しい更新版では数値や配置が変わる場合があります。\n')
(root/'COVER_ART_NOTE.txt').write_text('イラスト制作メモ\n組み込み画像生成で表紙と章ごとのイメージイラストを制作。章イラストはミカの添付立ち絵を参照。9場面のイラストを使用。文字とページレイアウトは別途組版。\nミカとロボの完成版スプライトを参照し、青いポニーテール・白いリボン・緑のトップス・青い短パン・茶色のブーツを維持。\n1980年代末の日本のゲーム攻略本をイメージした、インク線とガッシュの冒険イラスト。背景は廃墟・森・モアイ・空中鉄道・高層ビル。上部はタイトル用の余白。長老・宝物庫のイベント・脱出・エンディングは描かない。\n')
shutil.copy2(root/'pages/page-01.png',root/'MIKA_GUIDE_COVER_v005.png')
# 全ページの一覧。中面はページ別PNGが原寸。
sheet=Image.new('RGB',(1260,3278),'#172d45');draw=ImageDraw.Draw(sheet)
for i in range(62):
 im=Image.open(root/f'pages/page-{i+1:02}.png').convert('RGB');im.thumbnail((202,280));x=i%6*210+4;y=i//6*298+14;sheet.paste(im,(x,y));draw.text((x,y-12),f'{i+1:02}',fill='white')
sheet.save(root/'PAGE_INDEX.jpg',quality=90)
files=['READ_BOOK.html','README.txt','MIKA_GUIDE_TEXT.txt','page_titles.json','PAGE_INDEX.jpg','COVER_ART_NOTE.txt']
with zipfile.ZipFile(root/'MIKA_GUIDE_62P_v005.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in files:z.write(root/f,'MIKA_GUIDE_62P/'+f)
 for src in ['build_book_v5.py','extract.cjs','make_refs_v3.py','interview_v5.json','package_v5.py']:
  z.write(root.parent/src,'MIKA_GUIDE_62P/SOURCE/'+src)
 for f in sorted((root/'pages').glob('page-*.jpg')):z.write(f,'MIKA_GUIDE_62P/pages/'+f.name)
print('Reader bytes',(root/files[0]).stat().st_size,'ZIP bytes',(root/'MIKA_GUIDE_62P_v005.zip').stat().st_size)
