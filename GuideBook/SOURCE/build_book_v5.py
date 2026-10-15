from pathlib import Path
import json, math, colorsys, shutil, textwrap, io
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

ROOT=Path('/workspace/scratch/265e83887296/guide'); GAME=ROOT/'game/game'
D=json.loads((ROOT/'extracted/data.json').read_text()); MAPS=D['REF']['stageMaps']['maps']
OUT=ROOT/'output_v005'; OUT.mkdir(exist_ok=True); (OUT/'pages').mkdir(exist_ok=True)
VIS=ROOT/'visual'; VIS.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('JP',str(ROOT/('NotoSerifJP-Regular.ttf' if (ROOT/'NotoSerifJP-Regular.ttf').exists() else 'NotoSansJP-Regular.ttf'))))
pdfmetrics.registerFont(TTFont('JPB',str(ROOT/'NotoSansJP-Bold.ttf')))
W,H=420,595; NAVY='#172d45'; RED='#ba342c'; GOLD='#e7af3c'; PAPER='#fffdf5'; INK='#263240'; MUTED='#59656a'
C=canvas.Canvas(str(OUT/'MIKA_ADVENTURE_GUIDE_v005.pdf'),pagesize=(W,H)); C.setTitle('トレジャーハンターミカ ゴブリン族の秘宝 ウル秘テクニカルブック'); C.setAuthor('ロンカ冒険ブックス / 攻略本編集室')
PAGES=[]; TEXTS=[]; current=[]; cache={}
def rect(x,y,w,h,col,stroke=None):
 C.setFillColor(HexColor(col));C.setStrokeColor(HexColor(stroke or col));C.rect(x,H-y-h,w,h,fill=1,stroke=bool(stroke))
def line(x1,y1,x2,y2,col=NAVY,width=1):
 C.setStrokeColor(HexColor(col));C.setLineWidth(width);C.line(x1,H-y1,x2,H-y2)
def prose(s):
 s=str(s)
 for a,b in [('↑を押して','から'),('↑を押すと','入ると'),('↑を押す','入口がある'),('↑を試そう','入口を探したくなる'),('で↑。','から入れる。'),('でも↑。','にも入口がある。'),('で↑','の入口'),('↑。','入口がある。'),('押そう','進める'),('で←','で左へ')]:s=s.replace(a,b)
 return s.replace('↑','奥の道')
def text(s,x,y,size=10,color=INK,bold=False):
 s=prose(s)
 C.setFillColor(HexColor(color));C.setFont('JPB' if bold else 'JP',size);C.drawString(x,H-y-size*.86,str(s));current.append(str(s))
def para(s,x,y,w,size=10.2,leading=15.4,color=INK,bold=False):
 s=prose(s);font='JPB' if bold else 'JP';yy=y
 for block in str(s).split('\n'):
  buf=''
  for ch in block:
   if pdfmetrics.stringWidth(buf+ch,font,size)>w and buf and ch not in '、。！？）」』】・ー':
    text(buf,x,yy,size,color,bold);yy+=leading;buf=ch
   else:buf+=ch
  if buf:text(buf,x,yy,size,color,bold);yy+=leading
  else:yy+=leading*.6
 return yy
def chip(s,x,y,w=74,col=RED):
 rect(x,y,w,18,col);text(s,x+6,y+4,8.6,'#ffffff',True)
def frame(key):
 if key in cache:return cache[key]
 if key not in D['ATLAS']['frames']:key=D['ANIMS'].get(key,{}).get('frames',[key])[0]
 if key in D['ATLAS']['frames']:
  pg,x,y,w,h,tx,ty,cw,ch=D['ATLAS']['frames'][key];im=Image.open(ROOT/f'extracted/atlas_{pg}.png').convert('RGBA').crop((x,y,x+w,y+h));out=Image.new('RGBA',(cw,ch));out.paste(im,(tx,ty));bbox=out.getbbox();out=out.crop(bbox) if bbox else out
 elif key in D['BG']:out=Image.open(Path('/workspace/scratch/265e83887296')/D['BG'][key]['local']).convert('RGBA')
 else:return None
 cache[key]=out;return out
def sprite(key,x,y,w,h=None):
 im=frame(key)
 if im is None:return
 hh=h or w*im.height/im.width; scale=min(w/im.width,hh/im.height);ww=im.width*scale;hh=im.height*scale
 C.drawImage(ImageReader(im),x+(w-ww)/2,H-y-hh,width=ww,height=hh,mask='auto')
def bg(key):
 spec=D['BG'][key];return Image.open(Path('/workspace/scratch/265e83887296')/spec['local']).convert('RGBA')
def photo_reader(im):
 stream=io.BytesIO();im.convert('RGB').save(stream,format='JPEG',quality=84,subsampling=2);stream.seek(0);return ImageReader(stream)
def screen(key,x,y,w,crop=0,hero=False):
 im=bg(key);cw=min(384,im.width);xx=min(max(0,crop),max(0,im.width-cw));im=im.crop((xx,0,xx+cw,min(216,im.height)))
 under=Image.new('RGBA',im.size,'#badbf1')
 layers={'map_A':[('far_day',.15),('mid_day',.5)],'2A_main':[('2A_sky',.05),('2A_mountains',.24),('2A_moai',.6)],'3A_F1':[('3A_far',.15)],'3B_main':[('3B_far',.03),('3B_mid',.24)],'3C_main':[('3C_window',0)],'4A_train':[('4_sky',.05),('4_clouds',.2)]}
 for bk,factor in layers.get(key,[]):
  layer=bg(bk);lo=int(xx*factor)%layer.width;tile=Image.new('RGBA',im.size)
  for ox in range(-lo,im.width,layer.width):tile.alpha_composite(layer,(ox,0))
  under.alpha_composite(tile)
 under.alpha_composite(im);im=under.convert('RGB')
 if hero:
  for nm,px in [('idle',66),('robot_idle',34)]:
   sp=frame(nm);factor=.9 if nm=='robot_idle' else 1;sp=sp.resize((int(sp.width*factor),int(sp.height*factor)),Image.Resampling.NEAREST);im.paste(sp,(px-sp.width//2,180-sp.height),sp)
 h=w*im.height/im.width;C.drawImage(photo_reader(im),x,H-y-h,width=w,height=h);return h
def banner(s,y=526,col=NAVY):
 rect(24,y,372,33,col);para(s,34,y+8,352,9.1,13,'#ffffff',True)
def box(title,body,x,y,w,h,art=None):
 rect(x,y,w,h,'#fffdf4', '#d7c7a5');rect(x,y,w,21,RED if int(y//70)%2 else NAVY);text(title,x+8,y+5,10,'#ffffff',True)
 if art:
  sprite(art,x+8,y+28,56,max(21,min(58,h-34)));para(body,x+73,y+30,w-82,9.5,14)
 else:para(body,x+10,y+31,w-20,9.9,15)
def base(title,chapter,deck=''):
 global current
 current=[];PAGES.append(title);n=len(PAGES);C.bookmarkPage(f'p{n}');C.addOutlineEntry(title,f'p{n}',level=0);rect(0,0,W,H,PAPER);rect(0,0,10,H,RED);rect(10,0,W-10,24,NAVY)
 text('ロンカ冒険ブックス',24,7,8.2,'#ffffff',True);text(chapter,234,7,8.2,'#ffffff')
 rect(24,34,372,6,'#f4cb43');rect(24,41,372,2,'#9ccac7')
 para(title,24,46,372,21,25,NAVY,True)
 if deck:para(deck,24,77,372,9.5,14,MUTED)
 line(24,571,396,571,'#b9a989',.7);text('TREASURE HUNTER MIKA',24,578,7,NAVY,True);text(f'{n:02d}',374,576,10,RED,True)
def end():
 TEXTS.append('\n'.join(current));C.showPage()
def rowcards(rows,y=99,h=97):
 for i,r in enumerate(rows):box(r[0],r[1],24,y+i*(h+8),372,h,r[2] if len(r)>2 else None)
def table(rows,widths,y=110,head=None,rowh=35,size=9.3):
 x0=24
 if head:
  rect(24,y,372,24,NAVY);xx=x0
  for s,ww in zip(head,widths):text(s,xx+6,y+7,8.8,'#ffffff',True);xx+=ww
  y+=24
 for j,row in enumerate(rows):
  rect(24,y,372,rowh,'#f0e6cf' if j%2==0 else '#fffdf5');xx=x0
  for s,ww in zip(row,widths):para(s,xx+6,y+7,ww-12,size,13);xx+=ww
  y+=rowh
 return y
def enemygrid(ids):
 hints={'goblin':'基本の相手。足元をそろえて連続攻撃。','hobgoblin':'紫色の強化型。囲まれる前に倒そう。','death_goblin':'赤色の強化型。武器にも注意。','dark_goblin':'黒色の強敵。遠距離武器で先に削る。','skeleton':'盾を構えた正面は堅い。足払いが有効。','deathhound':'低い犬型。地上では下段攻撃で狙う。','ogre':'ガードされると打撃が通りにくい。','ograst':'黄色のオーガ。遅さを利用して軸ずらし。','big_ogre':'ピンクの大型。無理な接近は禁物。','ogyar':'赤いオーガ。強い武器を惜しまない。','gigas':'巨体の突進。予備動作を見たら軸を外す。','hill_gigas':'緑のギガース。攻撃後の隙を狙う。','yor_gigas':'橙色の巨人。正面で待ち続けない。','papa_gigas':'赤い巨人。高得点だが強敵だ。'}
 for i,k in enumerate(ids):
  mon=D['REF']['monsters'][k];x=24+(i%2)*190;y=102+(i//2)*136;rect(x,y,182,126,'#fffdf5','#d7c7a5');text(mon['name'],x+8,y+7,11,RED,True)
  face='enemy_face_'+k
  if face in D['ATLAS']['frames']:sprite(face,x+9,y+28,45,45)
  else:sprite(mon['family']+'_idle',x+9,y+28,45,45)
  text('ここに注目！',x+63,y+31,9,NAVY,True);text('色：'+mon['color'],x+63,y+49,8.6,MUTED)
  para(hints[k],x+8,y+82,166,9.2,13)
def stagepage(title,chapter,bgkey,route,notes,boss=None,second=None):
 base(title,chapter,route);screen(bgkey,24,103,372,384,True)
 yy=324
 if boss:
  sprite(boss[2],27,yy+8,87,112);text(boss[0],126,yy+2,14,RED,True);para(boss[1],126,yy+30,266,10,15)
 else:
  for head,body in notes[:2]:text(head,24,yy,12,RED,True);yy=para(body,24,yy+21,372,10.2,15.5)+15
 if boss:
  text(notes[0][0],24,461,12,NAVY,True);para(notes[0][1],24,482,372,10,15)
 banner(second or '敵の足元とミカの足元をそろえる。それが攻撃を当てる第一歩。');end()

# Shared illustration and map furniture.
ART=Image.open(ROOT.parent/'generated_images/exec-8f942bf1-e564-460d-9347-9e091a454e77.png')
def vignette(i,x,y,w):
 col=i%3;row=i//3;cw=ART.width/3;ch=ART.height/3
 im=ART.crop((int(col*cw+5),int(row*ch+5),int((col+1)*cw-5),int((row+1)*ch-5)))
 C.drawImage(photo_reader(im),x,H-y-w,w,w)
def chapter(title,deck,art):
 base(title,'イメージ・ストーリー',deck);vignette(art,24,111,372)
 rect(24,495,372,54,'#f8da5d');para('さあ、ページをめくろう！\nここから先は、君の冒険を助ける秘密がいっぱい。',34,505,350,11,17,NAVY,True);end()

def panorama(mid):
 m=MAPS[mid];wid=m['width'];im=Image.new('RGBA',(wid,216),'#a6ccdc')
 if mid=='2B':
  for k in ['2B_shaft','2B_carriage']:
   layer=bg(k);im.alpha_composite(layer.crop((0,0,min(wid,layer.width),min(216,layer.height))))
 else:
  for la in m.get('layers',[]):
   if 'bg' not in la or la['bg'] not in D['BG']:continue
   layer=bg(la['bg']);factor=la.get('factor',1);yy=int(la.get('y',0))
   if layer.height!=216 and layer.height>216:layer=layer.crop((0,0,layer.width,216))
   if factor==1 and layer.width>=wid:im.alpha_composite(layer.crop((0,0,wid,min(216,layer.height))),(0,yy))
   else:
    for xx in range(0,wid,384):
     tile=Image.new('RGBA',(384,216));start=int(xx*factor)%layer.width
     for ox in range(-start,384,layer.width):tile.alpha_composite(layer,(ox,yy))
     im.alpha_composite(tile,(xx,0))
 # Draw authored objects at their actual anchor, not fake screenshot actors.
 for p in m.get('props',[]):
  key=p.get('art')
  if not key and p.get('kind')=='chest':key='chest_'+p.get('chest_type','good')
  if key:
   sp=frame(key)
   if sp:
    ox,oy=p.get('origin',[sp.width/2,sp.height]);im.alpha_composite(sp,(int(p['x']-ox),int(p['y']-oy)))
 return im.convert('RGB')

def fullstrip(mid,x,y,w,marks=None):
 im=panorama(mid);h=w*216/im.width
 C.drawImage(photo_reader(im),x,H-y-h,w,h)
 for j,(px,label) in enumerate(marks or []):
  xx=x+px/im.width*w;line(xx,y+h-7,xx,y+h+9,RED,1.1);text(str(j+1),xx-3,y+h+10,8,RED,True)
 return im

def scenery_name(mid):
 if mid.startswith('1'):return '街の一角'
 if mid.startswith('2'):return '荒野と研究所'
 if mid.startswith('3'):return '妖精の国'
 if mid.startswith('4'):return '空中鉄道'
 return 'デスポリス'

def enemy_pages():
 groups=[(['goblin','hobgoblin','death_goblin','dark_goblin'],'小鬼の仲間たち'),(['skeleton','deathhound','ogre','ograst'],'盾と牙と怪力'),(['big_ogre','ogyar','gigas','hill_gigas'],'大きな影に気をつけろ'),(['yor_gigas','papa_gigas','mega_goblin','megamega'],'巨人と機械の兵隊'),(['tsugira','kaon','ashiin'],'見た目にだまされるな')]
 hints={'goblin':'基本の小鬼。足元を合わせ、連続攻撃をつなごう。','hobgoblin':'紫の小鬼。仲間と囲んでくる前に片側へまとめたい。','death_goblin':'赤い小鬼。持っている武器にも注意して間合いを取る。','dark_goblin':'黒い小鬼。無理な殴り合いを避け、武器を使おう。','skeleton':'盾を構えた正面は堅い。足払いで守りの下を狙おう。','deathhound':'低い姿勢の犬型。地上では下段攻撃を。飛びかかりにも注意。','ogre':'動きは重いが、ガードが厄介。奥行きをずらして隙を狙う。','ograst':'黄色い巨体。動きの遅さを利用し、一か所に止まらない。','big_ogre':'桃色の大きな影。ほかの敵に挟まれた状態で接近しない。','ogyar':'赤い怪力の持ち主。強い武器を温存しすぎないこと。','gigas':'巨体の突進が危険。構えが見えたら正面を離れよう。','hill_gigas':'緑色の巨人。突進をかわしたあとが反撃の好機。','yor_gigas':'橙色の巨人。追いかけるより、走り抜けた後を狙いたい。','papa_gigas':'赤い巨人。狭い場所で正面から受け止めるのは危険だ。','mega_goblin':'機械の体で武器も扱う。武装を見て近づき方を変えよう。','megamega':'大きなメカ。拳と射撃の切れ目を待って接近。','tsugira':'四脚で動く機械獣。速い移動と口のレーザーに注意。','kaon':'トゲのある顔タイヤ。目を見開いたら高速突進の合図！','ashiin':'タイツにハイヒールの脚が高速回転。追わずに進路を読もう。'}
 rumors={'goblin':'小鬼たちにも、宝を集める日課があるのかもしれない。','hobgoblin':'紫は一族の流行色？ 仲間への目配せも、どこか得意げだ。','death_goblin':'赤い姿は気合の表れ？ 拾った武器の見せびらかし合いをしていそう。','dark_goblin':'黒い姿で宝の見張り。暗い部屋で迷子にならないのだろうか。','skeleton':'盾の手入れだけは、生前から几帳面だったのかも？','deathhound':'宝のにおいを追う番犬？ おやつで気を引ければ楽なのに。','ogre':'通路が狭いのは、この一族の肩幅を考えなかったせい？','ograst':'黄色い体は荒野でも目立つ。かくれんぼは苦手そうだ。','big_ogre':'大きな体でも、宝箱を開けるときは指先が慎重になるのかも。','ogyar':'赤い巨体には小さな椅子は似合わない。休憩場所も大変そう。','hill_gigas':'緑の巨人が森で昼寝したら、うっかり木陰と間違えそう。','yor_gigas':'夕焼け色の巨人。走ってきたら、景色ごと動くような迫力だ。','papa_gigas':'一族でいちばん威張っていそう。でも宝箱の前では皆おなじ顔かも。','gigas':'止まるより走るのが好き。廊下の曲がり角には苦労しそう。','mega_goblin':'機械になっても、お宝への執着は小鬼ゆずりなのか？','megamega':'名前まで大きい。工場の出荷口を通れたのか気になる。','tsugira':'口から光線、足は四本。警備の仕事には熱心そうだ。','kaon':'この笑顔で突進するのだから、道を譲るしかない！','ashiin':'脚線美より回転数。靴屋泣かせの働き者、かもしれない。'}
 # Match sightings to authored spawn/encounter data, without inventing official lore.
 for ids,ttl in groups:
  base(ttl,'怪物大百科','特徴は攻略のヒント。「うわさ話」は編集部の想像だ。')
  for j,k in enumerate(ids):
   m=D['REF']['monsters'].get(k,{});name=m.get('name',{'tsugira':'ツギラ','ashiin':'アシーン','kaon':'カオーン','mega_goblin':'メガゴブリン','megamega':'メガメガ'}.get(k,k))
   family=m.get('family',k);rumor=rumors.get(k,rumors.get(family,'どんな暮らしをしているのだろう？'))
   if len(ids)==4:
    x=24+j%2*190;y=103+j//2*214
    spot('monsters',k,x+6,y,165,109);greenname(name,x,y+112,180)
    para(hints[k],x,y+133,179,9.3,13.5);para('うわさ話：'+rumor,x,y+166,179,8.7,12.5,MUTED)
   else:
    y=103+j*143;spot('monsters',k,24,y,151,128);greenname(name,187,y+7,210)
    para(hints[k],187,y+32,205,9.8,15);para('うわさ話：'+rumor,187,y+83,205,9.1,13,MUTED)
  banner('見た目、仕草、持ち物にも、その相手らしさがある。');end()

# Landscape foldout pages: a full panorama plus readable close-ups and annotated entrances.
def map_page(mid,title,route,tips,marks=(),boss=None,more=None):
 global W
 n=SCENE_NOTES[mid];tips=[(n[0],n[1]),(n[2],n[3])]
 if mid=='2B':
  base(title,'旅の全景アルバム','荒野の地下には、もう一つの世界があった。')
  im=panorama(mid);C.drawImage(photo_reader(im),24,H-103-209,372,209)
  sprite('idle',74,225,46,69);sprite('robot_idle',133,253,39,41)
  greenname(n[0],24,329,372);para(n[1],24,354,372,10.5,17)
  greenname(n[2],24,428,372);para(n[3],24,453,372,10.5,17)
  fullstrip('2C',24,523,372);end();return
 W=840;C.setPageSize((W,H));base(title,'旅の全景アルバム',route)
 # Extend the period color bands across the foldout.
 rect(420,0,420,24,NAVY);text('旅した景色を、ひとつながりに。',603,7,9,'#ffffff',True)
 rect(420,34,396,6,GOLD);line(420,571,816,571,'#b9a989',.7)
 text('全景マップ',24,99,10,RED,True)
 stripw=min(792,MAPS[mid]['width']*140/216);im=fullstrip(mid,24,120,stripw,marks)
 if stripw<600:vignette(8,656,120,140)
 # Guides must make the orientation unambiguous even on return paths.
 text('進行方向  '+('← 左へ' if mid in ['5B','5F','5G','5H'] else '右へ →'),24,120+stripw*216/im.width+29,9,NAVY,True)
 yy=120+stripw*216/im.width+53
 if yy>350:yy=352
 # Closeups from the beginning/end, full panorama remains above.
 if im.width>384 and not more:
  for x,xx,lab in [(24,0,'入口付近'),(224,max(0,im.width-384),'出口付近')]:
   cut=im.crop((xx,0,xx+384,216));C.drawImage(photo_reader(cut),x,H-yy-106,188,106);text(lab,x,yy+111,8.3,RED,True)
 elif not more:
  sprite('idle',45,yy,65,98);sprite('robot_idle',125,yy+37,60,60)
 # right column: practical tips and all annotated secrets.
 ry=yy
 for head,body in tips:
  rect(438,ry,378,20,'#dce8e5');text(head,446,ry+4,10,NAVY,True);ry=para(body,446,ry+27,360,10.1,15.4)+13
 if marks:
  rect(438,ry,378,20,'#f8d367');text('秘密の入口を探そう',446,ry+4,10,NAVY,True);ry+=27
  for j,(px,label) in enumerate(marks):ry=para(str(j+1)+' '+label,446,ry,360,9.3,14)+6
 if more:
  # Additional panorama strips for alternate paths in the forest.
  for mm,lab in more:
   fullstrip(mm,24,yy,390);para(lab,24,yy+49,390,8.5,12,RED,True);yy+=95
 if not more:
  ay=yy+134;aw=min(118,523-ay)
  if aw>40:
   ai=4 if mid[0]=='1' else 5 if mid[0]=='2' else 6 if mid[0]=='3' else 7 if mid[0]=='4' else 8
   if boss:
    sprite(boss[2],24,ay,aw,aw);greenname(boss[0],156,ay+5,250);para('こんな場所にも、強敵の姿。ミカと見比べると、その迫力がいっそうよく分かる。',156,ay+29,250,10,16)
   else:vignette(ai,24,ay,aw);para('窓の向こう、扉の奥。\n歩いてきた道には、まだ知らない顔がある。',156,ay+7,250,10,16,NAVY,True)
 rect(24,535,792,23,NAVY);text('寄り道も、景色のひとつ。地図の目印と、隠し部屋アルバムを見比べてみよう。',33,542,9,'#ffffff',True)
 end();W=420;C.setPageSize((W,H))
def secret_gallery(title,rooms,art):
 base(title,'隠し部屋アルバム','入口の場所は、各ステージの全景マップと見比べよう。')
 for j,(mid,caption) in enumerate(rooms):
  xx=24+j%2*190;yy=106+j//2*128
  rect(xx,yy,182,117,'#f4ead2');im=panorama(mid);C.drawImage(photo_reader(im),xx+4,H-yy-4-96,174,96)
  para(caption,xx+5,yy+103,172,8,11,NAVY,True)
 if len(rooms)<=4:
  vignette(art,24,386,119);para('編集部の宝探しメモ\n箱のそばに敵が待つ部屋もある。まず安全を確かめてから、中を調べよう。帰り道は入口の近く。↑で本線へ戻れる。',156,394,237,10,16)
 banner('見つけた部屋を覚えておけば、次の冒険はもっと充実するぞ！');end()
# New spot-illustration language: printed drawings on white, not screenshot cards.
PAPER='#ffffff'; ILL={k:Image.open(v) for k,v in json.loads((ROOT/'refs_v3/generated.json').read_text()).items()};SETS=json.loads((ROOT/'refs_v3/sets.json').read_text())
def spot(kind,key,x,y,w,h):
 idx=SETS[kind].index(key);im=ILL[kind];cols=4;rows={'weapons':3,'items':6,'monsters':5}[kind];cw=im.width/cols;ch=im.height/rows
 if kind=='weapons':
  edges=[[0,.278,.489,.760,1],[0,.260,.502,.780,1],[0,.263,.519,.731,1]][idx//4];xx=idx%4
  tile=im.crop((int(edges[xx]*im.width),int(idx//4*ch),int(edges[xx+1]*im.width),int((idx//4+1)*ch)))
 elif kind=='items':
  edges=[0,.156,.324,.483,.645,.806,1];rr=idx//4
  tile=im.crop((int(idx%4*cw),int(edges[rr]*im.height),int((idx%4+1)*cw),int(edges[rr+1]*im.height)))
 elif kind=='monsters':
  bounds=[(56,12,238,250),(343,12,522,251),(628,12,811,251),(915,12,1097,251),(21,279,278,518),(298,286,568,503),(593,271,836,522),(881,271,1122,522),(26,540,267,790),(310,540,553,791),(590,535,833,796),(882,536,1120,798),(21,808,260,1063),(304,809,545,1064),(599,809,816,1072),(860,817,1125,1068),(13,1099,300,1321),(336,1092,550,1317),(582,1093,859,1342)]
  l,t,r,b=bounds[idx];tile=im.crop((max(0,l-4),max(0,t-4),min(im.width,r+4),min(im.height,b+4)))
 else:
  tile=im.crop((int(idx%cols*cw),int(idx//cols*ch),int((idx%cols+1)*cw),int((idx//cols+1)*ch)))
 # Crop page-layout whitespace without changing illustration pixels.
 from PIL import ImageChops
 mask=ImageChops.difference(tile.convert('RGB'),Image.new('RGB',tile.size,'white')).convert('L').point(lambda v:255 if v>48 else 0)
 bounds=mask.getbbox()
 if bounds:
  l,t,r,b=bounds;tile=tile.crop((max(0,l-5),max(0,t-5),min(tile.width,r+5),min(tile.height,b+5)))
 scale=min(w/tile.width,h/tile.height);ww=tile.width*scale;hh=tile.height*scale
 C.drawImage(photo_reader(tile),x+(w-ww)/2,H-y-hh,ww,hh)
def greenname(s,x,y,w=220):
 text('●',x,y+1,9,'#248846',True);para(s,x+12,y,w-12,11,14,'#248846',True)
def artentry(name,body,kind,key,x,y,w=372,flip=False):
 ax=x+w-130 if flip else x;tx=x if flip else x+145;tw=w-145
 spot(kind,key,ax,y,130,78);greenname(name,tx,y+2,tw);para(body,tx,y+21,tw,9.5,14)

CHAPTER_TEXT={
0:('手紙が運んできたもの','部屋でひと休みしていたミカのもとへ、ロボがやってきた。手にしているのは手紙。そこに描かれた小鬼と宝を見れば、じっとしてなどいられない。','冒険に、相棒あり','勢いよく飛び出すミカを追いかける、小さなキャタピラー。ロボはお供の飾りではない。戦いで援護し、ときには倒れたミカを助ける。頼るばかりでなく、こちらも守ってあげたい仲間だ。','地図の外にも物語がある','道端の自販機、明かりの消えた売り場、奥へ続く小さな扉。急いで通り過ぎれば見落とすものばかり。ときには歩みを止め、ミカたちが旅する世界を眺めてみよう。'),
1:('拳の先に、道がある','ミカの戦いは、拳だけでは終わらない。蹴りをつなぎ、相手をつかみ、空中から飛び込む。同じ場所に立ち続けるより、動いて隙を作るのが彼女らしい。','一歩ぶんの奥行き','この世界には左右だけでなく、手前と奥がある。すぐ隣にいるような敵でも、足元がずれていれば拳は空を切る。ミカの足元を見ていると、戦いの景色が少し変わって見えるはず。','もう一度、空へ','ジャンプの頂点で、もうひと跳び。その先からもキックを出せる。見た目は軽やかだが、出す順番とタイミングが大事。慣れてきたら、空にいる時間もミカの味方になる。'),
2:('箱を開ける、その前に','ずっしり重い斧、細く光る刀身、青い光を抱いた砲。道中で出会う武器には、それぞれ違った顔がある。強さだけでなく、振ったときの気分まで想像してみたい。','宝とは、持ち帰りたくなるもの','宝石や王冠にまじって、ゲームソフトや本体まで転がっている。値打ちがあるから集めるのか、好きだから拾ってしまうのか。ミカの荷物袋の中身は、ずいぶんにぎやかになりそうだ。','小さなりんご、大きな安心','激しい戦いの途中では、きらびやかな宝より回復の品がうれしいこともある。少し元気になるおやつから、とっておきの薬まで。使いどころも含めて、旅の持ち物を眺めよう。'),
3:('怪物にも、いろいろある','小鬼に巨人、盾を持つ骨、笑う顔の機械。ミカの行く先には、まじめな顔では説明しにくい連中が待っている。まずは姿をじっくり眺めてみよう。','顔つきと仕草を読む','突進前に目を見開くもの、守りを固めるもの、やたら速く回るもの。強さの表だけでは分からない、その相手らしさが動きに出る。クセを知ることは、戦いにも役立つ。','編集部からの小さな想像','この図鑑のうわさ話は、姿や行動からふくらませた創作だ。公式の来歴ではないけれど、敵にも日々の暮らしがあると考えると、次に出会う顔が少しおかしく見えてくる。'),
4:('商店街の向こうに','壊れた街にも、かつて誰かが使った店や道が残っている。自販機、百貨店、路地の入口。ミカが駆け抜けるだけで、止まっていた景色がまた動きだすようだ。','お買い物とは、少し違う','百貨店の売り場には、いまでは小鬼たちがうろついている。品定めをしているのか、宝を守っているのか。そんな想像をする間にも攻撃は飛んでくるので、足元だけは忘れずに。','夕暮れの街まで歩こう','同じ街でも、空の色が変われば雰囲気は変わる。昼の道を抜け、屋内を通り、夕暮れへ。遠くの景色を見返すと、短い旅にも時間が流れていたことに気づく。'),
5:('石の顔は、何を見る','荒野に並ぶ大きなモアイ。静かな顔に見送られながら、ミカたちは奥へ進む。石像の大きさと小さな足取りを見比べるだけで、ずいぶん遠くへ来た気分になる。','地面の下に隠れた明かり','地上の景色とは対照的に、地下では機械や培養槽が光っている。古びた石と人工の設備。どうしてこんな所に研究所があるのだろう。答えを急がず、仕掛けを見つけていこう。','そっくりな相手','研究所の奥では、ミカによく似た姿が待ち構える。見慣れたような動きでも、相手にすると油断できない。自分ならいつ着地するか、いつ隙ができるか。観察する楽しさがある戦いだ。'),
6:('美しい森ほど、道が多い','花の道、キノコの道、葉の道。妖精の国では、奥へ続く小道が別の景色へつながる。似たような木々に囲まれても、よく見れば道の目印は違っている。','寄り道の楽しみ','正しい道だけが森の魅力ではない。小さな部屋に宝が隠されていたり、元の場所へ戻る道があったりする。迷ったらこの本を開けばいい。まずは気になった景色を覚えておこう。','森から雲へ、雲から城へ','緑を抜けると、足元にはふしぎな雲が広がる。その先には、光を受けた城。ミカとロボが見上げる景色は、進むごとに変わっていく。旅の中でも、とくに色鮮やかなひとときだ。'),
7:('風を切る黒い列車','車輪のない長い列車が、空を飛んでいく。空中鉄道777。その屋根に立てば、雲と風が流れ、遠くの世界が次々と近づいてくる。ミカたちの旅も、ここで大きく空へ広がる。','屋根の上にも日常？','鳥や飛行船を横目に、屋根ではいつものように戦いが始まる。乗客が窓から見上げたら、どんな顔をするだろう。編集部としては、静かな座席から眺めていたいところだ。','長い車両の先へ','屋根から車両へ、そして駅へ。扉の向こうには小部屋もある。乗り物であり、戦いの舞台でもある列車。ホームへ着いたとき、振り返ってその長さをもう一度見てみよう。'),
8:('空へ積み上がる都市','高いビルと、その間をつなぐ通路。デスポリスでは右へ進むだけでは目的地に着かない。階を上がり、ビルを渡り、また上へ。大きな建物そのものを旅するのだ。','明かりの残る部屋','会議室やオフィス、セキュリティ室。戦いの間にのぞく部屋には、それぞれ違う表情がある。廊下から一本それるだけで、都市の裏側に入りこんだ気分になる。','いちばん高い窓へ','外壁のエレベーターを乗り継ぎ、最後は超高速で展望台へ。見晴らしのいい窓の前で、ドクターSが待っている。その先の秘密は、この本でも開かずに取っておこう。')}
def chapter(title,deck,art):
 base(title,'冒険よみもの',deck);a,b,c,d,e,f=CHAPTER_TEXT[art]
 if title.startswith('開発者'):a,b,c,d,e,f=('冒険を作る人の話','ここからは、お楽しみの架空インタビュー。実際の取材記録ではなく、編集部が想像したゲーム制作の舞台裏だ。ミカやロボの話を、少し違う角度から読んでみよう。','動きと音が出会うとき','パンチが当たり、足が地面を離れ、見知らぬ場所へ扉が開く。ゲームは絵だけでも、音だけでもできていない。ふたつが合った瞬間の気持ちよさを、ミカの冒険でも味わってみたい。','読み終えたら、もう一度','知っている敵も、見慣れた道も、作る人の気持ちを想像してみると少し違って見える。読み終えたら、またミカを動かしてみよう。この本の先にある答えは、ゲームの中に待っている。')
 vignette(art,211,107,185);greenname(a,24,110,178);para(b,24,137,170,10.3,17)
 text('旅のひとこま',270,299,8,MUTED)
 greenname(c,24,326,372);para(d,24,351,372,10.2,17)
 greenname(e,24,415,372);para(f,24,440,372,10.2,17)
 end()

def item_reading_pages():
 weaponrows=[('刀','item_katana','すっと伸びた刀身に、余計な飾りはない。重さより手数を生かす、ミカらしい得物。振るう姿も軽やかだ。'),('戦塵の斧','item_war_axe','幅広い刃と重い柄。持ち上げるだけでも大仕事に見えるが、ミカは豪快に振り下ろす。地を走る波にも注目。'),('グングニルの槍','item_gungnir','青い飾りが目を引く長い槍。刃先を見つめていると、離れた相手まで届く間合いの長さにも納得する。'),('バトルハンマー','item_battle_hammer','分厚い金属の塊を、そのまま柄につけたような迫力。受けた敵が吹き飛ぶ姿まで想像できる。'),('波動砲','item_wave_cannon','青い光を抱く、いかにも特別な一丁。画面を横切る大技は、とっておきの出番まで取っておきたくなる。'),('マシンガン','item_machinegun','機械らしい黒い銃身が頼もしい。続けて撃てる便利さに、つい指を離すのを忘れそう。弾切れには気をつけたい。'),('ロケットランチャー','item_rocket_launcher','太い筒から、派手な爆発を起こす弾が飛び出す。ミカが肩に担ぐと、不思議なくらいよく似合う。'),('よいちの弓','item_yoichi_bow','曲がった木と一本の弦。見た目は素朴でも、一直線に飛ぶ矢は侮れない。構えたときの凛々しさも魅力だ。'),('火炎放射器','item_flamethrower','赤いタンクに、長い放射口。前へ吹く炎を見れば、敵でなくても思わず離れたくなる。燃料の使いすぎにはご用心。'),('ロケットパンチ','item_rocket_punch','赤い拳が武器そのものになっている。飛んで戻るたび、ミカの拳に負けない働きぶりを見せてくれる。')]
 for pg in range(2):
  base('旅の武器帖 '+('剣と斧と、不思議な砲' if pg==0 else '飛び道具いろいろ'),'道具の絵ものがたり','重さや手触りまで想像しながら、眺めてみよう。')
  for j,(name,key,body) in enumerate(weaponrows[pg*5:pg*5+5]):artentry(name,body,'weapons',key,24,105+j*83,flip=bool(j%2))
  end()
 base('冒険のおやつと、とっておきの薬','道具の絵ものがたり','傷ついたときほど、荷物袋の小さな品が心強い。')
 recovery=[('チョコレート','item_chocolate','包みを開けば、甘いひと休み。回復は控えめでも、険しい旅の途中ならうれしいおやつだ。'),('りんご','item_apple','つやつやした赤い皮と、みずみずしそうな実。少し元気を取り戻したら、また先へ歩き出そう。'),('ポーション','item_potion','赤い液体の入った小瓶。ほどよい回復が頼りになる、旅のお守りのような品。'),('ハイポーション','item_high_potion','緑に輝く薬。大きく体力を戻したいときの味方。無理をしてから探すより、場所を覚えておきたい。'),('エリクサー','item_elixir','金色の器に青い飾り。すっかり元気を取り戻す特別な品は、姿までひと味違って見える。')]
 for j,(name,key,body) in enumerate(recovery):artentry(name,body,'items',key,24,103+j*76,flip=bool(j%2))
 spot('weapons','aegis_shield_00',26,486,54,58);para('イージスの盾：青と銀の飾りが美しい特別装備。\nこの版では通常の入手方法を確認できていない。',90,497,300,8.6,13)
 end()
 descriptions=[('口をぎゅっと縛った袋。持ち上げたときの重さに、ミカもにやりとしそう。'),('きれいに束ねられたお札。どこの町で使われていたのだろう。'),('開いた瞬間、お札がぎっしり。宝石とは違った迫力がある。'),('赤い石の指輪。小さくても、光るところはしっかり光る。'),('切り口ごとに緑の光を返す宝石。つい空へかざしてみたくなる。'),('青い石のついた腕輪。冒険の装備というより、晴れの日のおしゃれ向き。'),('金の鎖と赤い飾り。宝箱の底から出てきたら、そっと持ち上げたい。'),('小さくても存在感のある金の像。顔つきをよく見ると、なんだか愛嬌がある。'),('赤と金がまぶしい冠。誰がかぶっていたか、想像がふくらむ。'),('澄んだ青白い輝き。宝と聞いて、まず思い浮かべるような一品。'),('宝にまじってゲームソフト。ミカも帰ったら遊ぶのだろうか？'),('本体まで見つかるのだから、宝探しも幅広い。持ち帰るのは少し大変そう。'),('赤いハートの一枚。そろえたくなる、不思議な魅力のあるカード。'),('黒いスペードの一枚。紙切れと決めつけて、置き去りにしないこと。'),('黒いクラブの一枚。小さな印にも、集める楽しみが詰まっている。'),('赤いダイヤの一枚。宝石と同じ名前でも、こちらはカードのお宝だ。')]
 its=[x for x in D['REF']['treasure']['items'] if x['id'] not in ['apple','chocolate']]
 for pg in range(2):
  base('宝物蒐集帖 '+('きらめく品々' if pg==0 else '王冠からゲームまで'),'道具の絵ものがたり','値札を忘れて、ひとつひとつ眺めてみよう。')
  for j,it in enumerate(its[pg*8:pg*8+8]):
   x=24+j%2*190;y=104+j//2*105
   spot('items','item_'+it['id'],x,y+16,76,76);greenname(it['name'],x,y,180);para(descriptions[pg*8+j],x+81,y+24,96,8.9,13)
  end()
 base('宝箱のある風景','道具の絵ものがたり','ふたを開けるまで分からない。その時間も、お宝だ。')
 ch=[('素朴な宝箱','chest_weak','木の板と鉄の帯。飾り気のない箱ほど、道端で見つけるとうれしい。中身を調べる前には、まわりをよく見よう。'),('よい宝箱','chest_good','赤茶の木に、金色の金具。箱そのものも持ち帰りたくなるような、宝箱らしい宝箱だ。'),('高級な宝箱','chest_high','青い色と金の装飾が目印。いつもの箱とは違う顔つきに、期待も少し大きくなる。'),('レアな宝箱','chest_rare','紫に金、さらに赤い飾り。大事なものをしまってありそうな姿は、見つけただけでも忘れにくい。')]
 for j,(name,key,body) in enumerate(ch):artentry(name,body,'weapons' if key=='chest_good' else 'items',key,24,111+j*91,flip=bool(j%2))
 para('箱の種類によって、中身の候補も違う。武器が入る箱もある。\n開けてみる楽しみを残しながら、隠れた場所まで歩いてみよう。',24,493,372,10,16)
 end()

# Magazine pacing: a story per page, actions as spectacle, scenic reading alongside maps.
CHAPTER_TEXT[1]=('考えるより、先に体が動く！','走って、跳んで、拳を振るう。ミカを一枚の写真に収めようとしたら、きっと撮るほうが大変だ。青い髪が翻るたび、次は何をするのか目が離せない。','小さな体に、大きな勢い','小鬼が並ぼうが巨人が現れようが、ミカの足取りは軽い。拳のあとに蹴りが飛び、相手の体が宙を舞う。宝探しの途中とは思えないほど、にぎやかな光景が続く。','空でも、ミカはミカ','ふわりと跳んだと思えば、空でもうひと跳び。そのまま蹴りまで飛び出すのだから、見ているロボも忙しい。旅の道中にちょっとした舞台ができたような、多彩な身のこなしだ。')
old_chapter=chapter
def chapter(title,deck,art):
 # The text and spot art remain one article; scene insets use the lower-left gap.
 old_end=globals()['end']
 def filled_end():
  scenic={0:'op_room_v067',1:'map_A',2:'2C_main',3:'3A_F1',4:'map_A',5:'2A_main',6:'3A_F1',7:'4A_train',8:'5I_main'}[art]
  screen(scenic,24,267,81,0,True);screen(scenic,112,267,81,384,True)
  for xx,off in [(24,0),(166,384),(308,768)]:screen(scenic,xx,519,88,off,True)
  old_end()
 globals()['end']=filled_end
 try:old_chapter(title,deck,art)
 finally:globals()['end']=old_end

def story_page():
 base('一通の手紙で、日常はおしまい！','巻頭ものがたり','宝のにおいがしたら、ミカはもう止まらない。')
 vignette(0,24,105,180)
 greenname('ミカの目が、きらり。',219,107,177)
 para('のんびりしていたミカのもとへ、ロボが一通の手紙を届けに来た。そこに描かれていたのは、ゴブリンたちと山ほどの宝。退屈そうだった目が、たちまち輝きだす。',219,134,174,10.5,17)
 screen('op_room_v067',24,302,180);screen('op_letter_closeup_v067',216,302,180)
 greenname('相棒を引っぱって、さあ冒険へ！',24,416,372)
 para('準備はいい？ と聞くより早く、ミカは立ち上がっていた。ロボを引っぱり、部屋の外へ一直線！ 廃墟の商店街、石像の荒野、妖精の森、空を飛ぶ列車へ。小さな手紙から、ずいぶん大きな旅が始まってしまった。',24,443,372,11,18)
 para('ゴブリン族の秘宝。その正体は、まだ誰も知らない。',24,535,372,11,16,RED,True);end()

def action_feature():
 base('じっとしてなんか、いられない！','ミカの大暴れ劇場','お宝を追いかけているのか、騒ぎを追いかけているのか。')
 im=Image.open(ROOT/'visual/actions_v4.png');C.drawImage(photo_reader(im),24,H-105-255,372,255)
 greenname('拳も、足も、ミカは全力。',24,377,372)
 para('びゅんと駆け出し、くるりと跳んで、ぱんと一撃。さっきまで地面にいたはずのミカが、もう空で笑っている。敵を持ち上げたと思えば、次には豪快な得物を振りかざす。この忙しさ、ロボはちゃんと追いつけるのだろうか？',24,404,372,11,18)
 screen('map_A',24,492,116,384,True);screen('3A_F1',152,492,116,768,True);screen('4A_train',280,492,116,768,True)
 end()

SCENE_NOTES={
'1A':('廃墟にも、暮らしの名残','店先の自販機や街灯、ゆるんだバリケード。かつての商店街を思わせる道に、いまは小鬼たちの足音が響く。ミカが駆け抜けると、静かな街がたちまち騒がしくなる。','路地の先は、別の顔','大通りから少し奥をのぞくと、隠れた部屋につながっている。見つけた先に、さらにもう一部屋。街は見えている道だけでできていないらしい。'),
'1B':('本日の売り場は大騒ぎ','百貨店には、どこか懐かしい屋内の明かりが残っている。お買い物のかわりに小鬼と出会う売り場とは、なかなか落ち着かない。並んだ品や壁の飾りも気になるところだ。','壁の向こうの小さな秘密','通り道には隠し部屋がある。その中には、壊れた壁の向こうへ続く場所も。店員も知らない売り場の奥、と考えると、少しわくわくしてくる。'),
'1C':('街にも夕暮れがやって来る','百貨店を抜けると、空は昼とは違った色になっている。同じような道でも、明かりと影だけで雰囲気が変わる。ミカたちの旅にも、ちゃんと時間が流れているのだ。','大きな影が待っていた','夕暮れを眺めている暇は、あまりなさそうだ。行く手には、伸びる腕と銃を持つ大きなロボ。見上げるような相手の前でも、ミカの顔から元気は消えない。'),
'2A':('石の顔たちに見送られて','夜の荒野にモアイが並ぶ。どこを見ているのか分からない石の顔の前を、小さなミカとロボが通っていく。静けさと妙なおかしさが同居する道だ。','地中へ続く明かり','荒野の奥には、風景にまぎれるように基地の入口がある。大きな石像の下で、機械の研究が行われている。そんな取り合わせが、この場所をいっそう奇妙に見せている。'),
'2B':('地下へ、地下へ','荒野から一転、機械に囲まれた昇降路へ。狭い場所にミカとロボが乗り込むと、どこまで続いているのか分からない地下の気配が迫ってくる。','静かな移動にはならない','ただ目的地まで運んでもらうだけなら、ずっと楽なのに。敵もやってくるのだから、エレベーターの中までにぎやかだ。着いたころには、ちょっとした運動になっていそう。'),
'2C':('ガラスの中で、何かが光る','研究所では培養槽や装置が怪しく光っている。地上のモアイとは正反対の人工的な風景だ。中にいるものが飛び出してくるとなれば、のんびり見学ともいかない。','似ているからこそ、不思議','奥に待つ相手は、どこかミカによく似ている。見覚えのある姿がこちらに向かって来る光景には、ほかの強敵とは違う奇妙さがある。'),
'3F1':('花の道、キノコの道','森の小道は、よく似た別の景色へつながっている。花やキノコが道しるべ。美しい場所ほど寄り道が多いというのも、妖精の国らしいいたずらかもしれない。','看板と、光の階段','森の奥で見つかる右向き看板は、迷った旅人の味方。さらに進んだ広場では強敵が待ち、その先には光の階段。緑の向こうに空が続いている。'),
'3B':('足元にも、空の景色','森を抜ければ、ふわふわした雲の国。見上げるだけだった雲が足元の景色になると、旅の気分も変わってくる。ロボのキャタピラーが、いつもより軽く見えそうだ。','雲の向こうに城がある','淡い色の風景の奥に、次の場所へ続く入口がある。森から雲へ、雲から城へ。妖精の国は、ページをめくる絵本のように景色を変える。'),
'3C':('宝石箱のような城','光を受ける窓、華やかな飾り、奥へ続く回廊。ミカの服装とは少し違う、優雅な世界が広がっている。バルコニーの向こうにも、小さな秘密が隠されている。','きらびやかな女王の舞台','ここで待つゴブリンクイーンは、炎と雷、そして消える姿でミカを迎える。城の美しさまで舞台装置に見えてくる、華やかで危ない出会いだ。'),
'4A':('風を切る、長い屋根','車輪のない列車が空を飛ぶ。それだけでも十分不思議なのに、ミカたちは屋根の上で大暴れ。雲の流れや遠くを横切る鳥まで、旅のにぎわいに加わってくる。','列車の長さだけ、旅がある','屋根の先から次の車両へ。足元の黒い鉄と、見渡すかぎりの空との取り合わせがたまらない。ふつうの乗客には、なかなかできない旅だ。'),
'4B':('車窓の外は、ずっと空','長い車両が連なる空中鉄道。窓の外を雲が流れ、扉の向こうにはまた別の部屋がある。安全な席から眺めてみたくもなるが、ミカの車内旅行はそうはいかない。','整備室にも物語がある','車両の奥には、印のないハッチから続く整備室まである。空を走る列車にも、裏方の場所は必要なのだ。旅客の目に触れない鉄道の顔をのぞいてみよう。'),
'4C':('空の旅の、途中駅','列車がたどり着くデスポリス駅。ホームに降りると、長い乗り物の大きさがあらためて分かる。停車した車両の扉にも、ちょっとした寄り道が残っている。','顔の大きな出迎え役','駅の奥で待つのは、巨大な顔のダンダルモン。砲台に口のレーザー、目からの光。案内係と呼ぶには、あまりにも騒々しい出迎えだ。'),
'5A':('都会の顔、ビルの入口','明かりの残る受付や広い床。デスポリスの冒険は、立派な建物の一階から始まる。右手の外壁エレベーターが、この先の縦に長い旅を予感させる。','扉の向こうの、さらに奥','廊下の部屋だけで満足してはいけないらしい。別の部屋の奥から、もっと深い場所へ。外から見た整った建物にも、知らない空間がいくつも隠れている。'),
'5B':('同じビルの、違う顔','高い階に上がると、窓と床の印象も変わる。こちらの廊下は右側から左へ続く。来た道のつもりで眺めていると、建物の構造に少し戸惑いそうだ。','会議室に何が集まる？','廊下の奥には会議室がある。いまは誰が何を話し合うのだろう。さらに奥の部屋まで続いているので、のぞくたびに想像がふくらむ。'),
'5C':('窓の外には、別のビル','高層都市では、廊下の先にまた別の建物が見えてくる。広く見える床と、実際に歩く道の違いにも都会らしい奥行きがある。','連絡通路への道','右の先には、二つのビルを結ぶ通路。建物の中を歩いていたはずが、空中を渡る旅へ変わる。窓の景色がぐっと近くなる場所だ。'),
'5D':('空中に架かった廊下','ガラス越しに街が広がる連絡通路。屋外にいるようで、足元はしっかり屋内の床。都市の大きさが、ふたつの建物の間にすっぽり収まって見える。','こんな所にも、大きな顔','通路の終わりには、またダンダルモンが待っている。大きな顔が窓のある廊下をふさぐ光景は、何度出会っても妙な迫力がある。'),
'5E':('高い階にも、お店がある','バブイルトレンドセンターには、鮮やかな売り場が並ぶ。荒野や森を歩いてきたあとだけに、この買い物風景がかえって不思議に見えてくる。','外壁沿いに、さらに上へ','右手のエレベーターが、ミカたちをもっと高い階へ運ぶ。窓の外の街が下へ遠ざかるたび、秘宝までの道も近づいているのだろうか。'),
'5F':('到着したら、反対側へ','右側の乗り場から、左へ続く廊下。二つのビルの旅は、進む向きを何度も変える。窓の景色ばかり見ていると、同じ階へ戻ってしまいそうだ。','警備の部屋も、油断ならない','セキュリティ室という響きには、どこか安心感がある。けれど、ここに現れるのは素早い怪物たち。守られているのは、どうやらミカのほうではなさそうだ。'),
'5G':('また一つ、空を渡る','今度の連絡通路は右から左へ。見慣れた建物も、高い所から眺めれば別の街に見える。ガラスの向こうの景色だけ、しばらく見ていたくなる道だ。','二つのビルの、間の時間','廊下とエレベーターを乗り継ぐ旅の途中で、通路は小さな橋になる。次の建物で何が待っているか。ミカの足取りも、少しだけ楽しげに見える。'),
'5H':('いよいよ、いちばん上へ','この階の左端にあるのが、展望台行きの高速エレベーター。普通の移動で終わるとは思えない乗り場に、ミカたちも身構えることになりそうだ。','オフィスの日常は、どこへ','通路の奥にはオフィスが残る。机や明かりのある部屋と、外を暴れ回る怪物たち。デスポリスでは、その取り合わせにも次第に慣れてしまう。'),
'5I':('高い窓の、その向こう','ようやくたどり着いた展望台。長い窓の外には、登ってきた都市の景色が広がる。奥の壁にある小さな扉も、ここまで来た旅人への秘密の寄り道だ。','眺めを独占する円盤','行く手で待つウルトラマシーンS。景色を楽しむだけの時間には、してくれないらしい。ドクターSとミカ、いよいよ大きな出会いの場面だ。')}

# Fill substantial article gaps with relevant scene insets, preserving type and art.
BANDS=[]
_base=base

def base(*a,**kw):
 BANDS.clear();return _base(*a,**kw)
_rect=rect

def rect(x,y,w,h,col,stroke=None):
 if y>=95 and y<565 and h<250 and w>20:BANDS.append((y,min(565,y+h)))
 return _rect(x,y,w,h,col,stroke)
_text=text

def text(s,x,y,size=10,color=INK,bold=False):
 BANDS.append((y,y+size*1.1));return _text(s,x,y,size,color,bold)
_drawImage=C.drawImage

def capture_image(img,x,y,width=None,height=None,*a,**kw):
 if height:BANDS.append((H-y-height,H-y))
 return _drawImage(img,x,y,width=width,height=height,*a,**kw)
C.drawImage=capture_image
_end=end

def end():
 if len(PAGES)>1:
  intervals=sorted((max(101,a),min(561,b)) for a,b in BANDS if b>101 and a<561)
  gaps=[];cur=101
  for a,b in intervals:
   if a>cur:gaps.append((cur,a))
   cur=max(cur,b)
  if cur<561:gaps.append((cur,561))
  if gaps:
   a,b=max(gaps,key=lambda z:z[1]-z[0]);gap=b-a
   if gap>77:
    title=PAGES[-1];key=('2C_main' if '研究' in title else '3A_F1' if any(t in title for t in ['森','妖精']) else '4A_train' if any(t in title for t in ['777','列車']) else '5I_main' if any(t in title for t in ['ビル','デスポリス','展望']) else 'map_A')
    pic=panorama({'map_A':'1A','2C_main':'2C','3A_F1':'3F1','4A_train':'4A','5I_main':'5I'}[key]);ww=W-48;hh=min(gap-12,130);ratio=ww/hh;cw=min(pic.width,int(pic.height*ratio));ch=min(pic.height,int(cw/ratio));left=(pic.width-cw)//2;top=(pic.height-ch)//2;pic=pic.crop((left,top,left+cw,top+ch))
    C.drawImage(photo_reader(pic),24,H-a-6-hh,ww,hh)
 _end();BANDS.clear()

# Eight-page magazine conversation, with continuous text in two balanced columns.
def interview_feature():
 from reportlab.platypus import Paragraph
 from reportlab.lib.styles import ParagraphStyle
 from xml.sax.saxutils import escape
 pdfmetrics.registerFontFamily('JP',normal='JP',bold='JPB',italic='JP',boldItalic='JPB')
 sections=json.loads((ROOT/'interview_v5.json').read_text())
 for ix,section in enumerate(sections):
  base('巻末特大インタビュー' if ix==0 else section['title'],'制作室ロングトーク',f"PART {ix+1} / {len(sections)}　"+(section['title'] if ix==0 else '寄り道だらけのミカ開発談義'))
  para(section['lead'],24,101,372,9.2,13.2)
  if ix==0:text('聞き手／ロンカ冒険ブックス編集部　話し手／開発担当',24,132,7.5,MUTED)
  start=146 if ix==0 else 138
  chosen=None
  for sz in [9.7,9.5,9.3,9.1,8.9]:
   sty=ParagraphStyle('Talk',fontName='JP',fontSize=sz,leading=sz*1.35,wordWrap='CJK',textColor=HexColor(INK))
   paras=[]
   for who,body in section['dialogue']:
    label='編集部' if who=='編集' else '開発'
    col=RED if who=='編集' else NAVY
    p=Paragraph(f'<font color="{col}"><b>{label}</b></font>　'+escape(body),sty);_,h=p.wrap(178,1000);paras.append((p,h,who,body))
   scores=[]
   for cut in range(1,len(paras)):
    left=sum(p[1]+1.8 for p in paras[:cut]);right=sum(p[1]+1.8 for p in paras[cut:]);scores.append((max(left,right),abs(left-right),cut,left,right))
   best=min(scores)
   if start+best[0]<=494:chosen=(paras,best,sz);break
  if chosen is None:raise ValueError('Interview page too long: '+section['title'])
  paras,best,sz=chosen;cut=best[2];print('Interview',ix+1,'font',sz,'height',round(best[0],1))
  for xx,chunk in [(24,paras[:cut]),(218,paras[cut:])]:
   yy=start
   for p,h,who,body in chunk:
    BANDS.append((yy,yy+h));p.drawOn(C,xx,H-yy-h);current.append(who+'：'+body);yy+=h+1.8
  line(210,start,210,495,'#d2c5a3',.55)
  rect(24,502,372,54,NAVY);vignette(section['art'],26,503,51)
  para('「'+section['quote']+'」',93,510,292,11.5,15.5,'#fff4bc',True)
  text('制作室・取材ノート',93,545,7,'#ffffff')
  end()

# 01 表紙
current=[];PAGES.append('表紙');C.bookmarkPage('p1');C.addOutlineEntry('表紙','p1',level=0)
cover=ROOT.parent/'generated_images/exec-cf64b93c-afd6-4221-8ef8-919eeb447a5b.png'
C.drawImage(photo_reader(Image.open(cover)),0,0,width=W,height=H)
text('ウル秘テクニカルブック',21,153,18,'#182543',True);text('ウル秘テクニカルブック',20,151,18,'#ffdc41',True)
text('お宝、怪物、秘密の道！',18,533,19,'#111b25',True)
text('ミカの世界を読みつくせ！',18,556,16,'#111b25',True)
text('冒険よみもの決定版！',18,576,15,'#111b25',True)
# The burst tilts upward: typeset a centered two-line lockup in its inner area.
C.saveState();C.translate(355,H-550);C.rotate(12);C.setFillColor(HexColor('#07337f'));C.setFont('JPB',12.5);C.drawCentredString(0,5,'全景マップ');C.setFont('JPB',12);C.drawCentredString(0,-13,'怪物大図鑑');C.restoreState();current.extend(['全景マップ','怪物大図鑑'])
end()
#02
base('冒険の目次','はじめに','宝を見つけたい君に贈る、必勝の手引き。')
contents_slot=len(PAGES)
for j,(a,b) in enumerate([('物語と仲間たち','一通の手紙・ミカとロボ'),('ミカの大暴れ劇場','絵で楽しむ、ミカの身のこなし'),('武器・宝・回復図鑑','見つけたものの絵ものがたり'),('怪物大百科','特徴と、編集部のうわさ話'),('ナンザスシティ','街と百貨店の隠し入口'),('モアイ荒野','地下のヒミツを探れ'),('妖精の国','森の正解ルートを大公開'),('空中鉄道777','屋根・車両・駅を丸ごと案内'),('デスポリス','二つのビルと展望台の戦い'),('開発者に聞こう！','巻末・特大ロングインタビュー')]):
 rect(24,103+j*37,372,31,'#dbe8dd' if j%2 else '#fff0bc');text(a,31,108+j*37,10,NAVY,True);text(b,177,110+j*37,8.1);text(str([3,6,8,15,21,26,31,36,41,55][j]),375,109+j*37,9,RED,True)
para('本書は受領した完成版の背景と配置をもとに編集。地図は静止画として再構成したものだ。全編の通しプレイによる検証済みではなく、更新版では配置が変わる場合がある。',24,490,372,8.7,13)
banner('ドクターSの先は、君の目で確かめよう！');end()
story_page()
#04
base('主人公ミカを知ろう','キャラクター紹介','青い髪と白いリボンが目印。拳ひとつでも道を切り開く！')
sprite('idle',30,108,105,155);sprite('punch',165,123,105,123);sprite('jump_kick',289,111,106,145)
chip('得意技：素手',25,281,110);chip('武器も10種類！',149,281,120);chip('二段ジャンプ',283,281,113)
para('拳にキック、空中のひと跳び、そして拾った大きな武器まで。ミカの姿は、見ていて飽きる暇がない。いつもの通りを走っているだけでも、次の瞬間には騒ぎの中心。宝探しに向いているのは、こういう元気な性分なのかもしれない。',24,321,372,11,17)
box('お宝を前にした、その顔！','青い髪と白いリボンがひるがえる。手にした武器より先に目を引くのは、どこへ行っても変わらないミカの勢いだ。大きな敵の前でも、お宝の前でも、見ているこちらが元気になってしまう。',24,415,372,93)
banner('青い髪・白いリボン・緑のトップス・短パン・茶色のブーツ。');end()
#05
base('頼れるロボと、妖精たち','キャラクター紹介','ロボは飾りではない。冒険のもう一人の主役だ。')
box('自律支援ロボ','キャタピラーでミカについてくる相棒。サブマシンガンとミサイルで援護する。ミカが倒れたとき、ロボが動ければ救命のチャンスがある。',24,102,372,111,'robot_idle')
box('ロボが壊れたら？','白旗と煙が出たときは、ちょっとひと休み。それでも、この相棒はやがて元気を取り戻してまたついてくる。小さな体に詰まっているのは、武器だけではなく、なかなかの根性らしい。',24,224,372,103,'robot_broken')
box('妖精の国の住人','ピンク・青・黄色の妖精たち。森や雲、城の世界を彩る。怪しいゴブリンだけを追って、周囲の不思議な景色を見逃さないように！',24,338,372,107,'fairy_pink')
sprite('fairy_blue',304,464,39,43);sprite('fairy_yellow',350,464,39,43)
banner('倒れてもロボが元気なら、まだ冒険は終わらない。');end()
chapter('ミカは、止まらない！','走る。跳ぶ。笑う。宝探しは、いつでも大騒ぎ。',1)
action_feature()
chapter('お宝と武器の大図鑑','見つけた品を、使いこなせ！',2)
item_reading_pages()
chapter('怪物大百科','こいつらのクセを、見抜けるか？',3)
enemy_pages()
chapter('ナンザスシティ','廃墟の商店街に、お宝の気配！',4)
map_page('1A','ナンザスシティ','街の入口から百貨店へ。右へ進もう。',[('まずは足元をそろえよう','自販機やバリケードの間に敵が集まる。上下に動いて攻撃をかわし、同じ奥行きに並べてから連続攻撃だ。'),('路地の奥にもお宝が？','隠し部屋に入ったら、右奥まで調べたい。最初の部屋からさらに奥へ進める。')],[(1343,'街の後半、奥の入口で↑。部屋の右奥でも↑を試そう。')])
map_page('1B','オラクル百貨店','にぎやかだった売り場を、右へ抜ける。',[('狭い売り場で囲まれるな','敵を片側にまとめること。投げで仲間にぶつければ、固まった集団を崩せる。'),('壁を壊せば、もう一部屋','前半の隠し部屋では右の壁を攻撃。壊した先にも宝が待っている。')],[(492,'前半の奥の入口で↑。室内の右壁を壊して、さらに奥へ。'),(1682,'終盤にも別の入口。右端へ急ぐ前に調べよう。')])
map_page('1C','ナンザスシティ','夕暮れの街を進む。百貨店を抜けても油断は禁物。',[('回復を見逃さない','大きな敵に備えて体力を整えたい。拾い物の前に周囲を片づけ、ロボの調子も見ておくこと。')],boss=('ゴブリンロボ','伸びるパンチと銃撃、踏みつけが危険。着地点を離れて、攻撃後に反撃しよう。','goblin_robot_idle'))
secret_gallery('街と百貨店の隠し部屋', [('1A_H1','街の路地から入る部屋'),('1A_H2','路地の部屋の、さらに奥'),('1B_H1','百貨店・前半の部屋'),('1B_H2','壁を壊した先の部屋'),('1B_H3','百貨店・終盤の部屋')],4)
chapter('モアイ荒野','巨大な石像の下に、何かが眠る。',5)
map_page('2A','モアイ荒野','石像の列を右へ。奥に研究所の入口がある。',[('石像の影も調べよう','モアイや地上の障害物の間を敵が動く。正面で足を止めず、攻撃の向きから外れる。'),('基地のシャッターを探せ','終盤の奥にあるシャッター前で↑。地上を歩き続けるだけでは、地下へは入れない。')],[(1666,'基地の入口。シャッターの前まで奥へ寄って↑。')])
map_page('2B','ヒミツ研究所入り口','地下へ続くエレベーター。停車中の敵に注意。',[('左右をよく見よう','移動する床にいる間も戦いは続く。片側へ敵を寄せ、背中を取られないように。'),('降りたら研究所へ','停車中と移動中を見分けよう。出口の扉から、さらに奥の研究所へ進める。')])
map_page('2C','ヒミツ研究所','培養槽の並ぶ廊下を右へ。',[('槽の中だけを見ないこと','近づくと敵が飛び出す装置がある。飛び出した相手を避けて、床や奥の仕掛けも調べよう。')],[(1008,'廊下の中央付近にあるハッチを壊し、その場所で↑。隠し部屋へ入れる。')],boss=('ダークミカ','刀と空中攻撃、後半の銃撃に注意。着地後の隙を狙おう。落とした刀は拾うチャンス！','dark_mika_idle'))
secret_gallery('研究所の隠し部屋', [('2C_H1','ハッチの下に広がる秘密')],5)
chapter('妖精の国','この森は、まっすぐ歩くだけじゃ抜けられない。',6)
map_page('3F1','マヨイの森','花・キノコ・葉の道が、似た森をつないでいる。',[('正解ルートはキノコから','最初の森の中ほど、キノコの小道で↑。移った森では後半の花の小道で↑を押そう。'),('右向き看板を見つけたら','次の森は右へ進む。後半の戻る小道には入らず、終端の広場を目指そう。ロボの強敵を倒すと光の階段が現れる。')],[(948,'最初の森：中央のキノコ道が正解への入口。'),(1840,'最初の森：右奥のキノコ道は隠し部屋へ。')],more=[('3F2','移った先の森：後半の花の道が正解。右奥の葉の道は隠し部屋。'),('3F3','看板のある森：右へ抜ける。終端の広場から光の階段へ。')])
map_page('3B','雲の上','ふわふわした雲の国から、妖精の城へ。',[('床と背景を見分けよう','雲が浮いていても、歩ける足場は別。ミカの足元を見ながら上下位置を合わせ、集団を片側に寄せたい。'),('奥の入口で↑','終盤の奥に、城へ続く入口がある。右端だけを探さず、背景の道にも注目しよう。')],[(1686,'城へ続く入口。奥へ寄って↑を押そう。')])
map_page('3C','妖精の城','美しい城の奥で、女王が待つ。',[('バルコニーに寄り道しよう','城の中ほどにある入口は、隠し部屋につながる。強敵に挑む前に宝や武器を探そう。')],[(1008,'中ほどのバルコニー入口で↑。部屋からは左側の入口へ戻る。')],boss=('ゴブリンクイーン','炎と雷をかわし、姿を現して攻撃し終えたところを狙う。ワープ中は追い回さない。','queen_idle'))
secret_gallery('妖精の国の隠し部屋', [('3H1','最初の森・奥のキノコ道'),('3H2','次の森・奥の葉の道'),('3C_H1','城のバルコニーから')],6)
chapter('空中鉄道777','風を切り、はるかな空へ。',7)
map_page('4A','空中鉄道777 屋根','空飛ぶ列車の屋根を、右へ進もう。',[('屋根の上でも足元を見よう','高速で流れる空に気を取られないこと。敵と足元をそろえ、障害物を片づけながら進む。'),('終端はジャンプで乗り移る','出口の案内が出たら右へ。屋根から次の車両へ移る演出につながる。飛行船や鳥も空を横切るぞ。')])
map_page('4B','空中鉄道777 車両','長い列車を進む。奥の扉に寄り道がある。',[('扉が全部、入口とは限らない','前半と後半の本物の入口を覚えよう。室内にも敵が待つので、回復してから入りたい。'),('隠し部屋にも隠し入口','前半の部屋に入ったら、左寄りの印のないハッチで↑。さらに奥の整備室へ入れる。')],[(546,'前半の扉で↑。室内の左寄りに、さらに奥へのハッチがある。'),(1314,'後半の扉でも↑。帰りは入口付近で↑を押す。')])
map_page('4C','デスポリス駅','列車が駅へ到着。ホームを右へ進む。',[('ホームの扉にも寄り道','駅に停まる列車の扉には、入れるものがある。怪しい所で奥へ寄り、↑を試そう。')],[(612,'前半の本物の扉。室内を探索してからホームへ戻ろう。'),(1372,'後半の本物の扉。強敵の前に武器を補給したい。')],boss=('ダンダルモン','砲台と口のレーザー、目のビームに注意。攻撃の切れ目に武器を当て、正面に居座らない。','dand_idle'))
secret_gallery('列車と駅の隠し部屋', [('4B_H1','車両・前半の扉'),('4B_H1A','ハッチの先の整備室'),('4B_H2','車両・後半の扉'),('4C_H1','駅・前半の本物の扉'),('4C_H2','駅・後半の本物の扉')],7)
chapter('デスポリス','二つのビルを登り、秘宝を追え！',8)
map_page('5A','ヴァンパイアステートビル 1F','右端の外壁エレベーターから、上階へ。',[('右の乗り場へ歩いて乗ろう','エレベーターとビルの扉がつながっている。足元を合わせて乗り場へ進もう。'),('部屋の奥にも部屋がある','後半の扉から入った部屋は、その右奥も調べたい。見える宝だけで帰らないこと。')],[(717,'前半の奥の扉で↑。'),(1187,'後半の奥の扉で↑。室内の右奥から、さらにもう一部屋へ。')])
map_page('5B','VSビル13F','到着は右側。今度は左端の外壁エレベーターへ。',[('進む向きが逆になる！','右へ戻ると到着した乗り場だ。ここでは左へ進み、左端からさらに上の階へ向かう。'),('会議室の奥を調べよう','通路の中ほどの扉で↑。会議室の右奥から、さらに奥の部屋へ進める。')],[(578,'通路中央の会議室入口。奥の部屋も見逃さないこと。')])
map_page('5C','VSビル37F','エレベーターを降りたら、右へ。',[('広く見える床に注意','背景の奥まで歩けるわけではない。ミカの足元を見ながら、通路の範囲で戦おう。'),('別のビルへ向かう','出口は右側。進んだ先の連絡通路を渡り、隣のビルへ向かう。')])
map_page('5D','連絡通路','高い空に架かる道を、右へ渡る。',[('ガラスの向こうに気を取られるな','歩けるのは足元の通路。奥へ寄りすぎず、敵の射線と上下位置を見よう。'),('巨大な顔が行く手をふさぐ','終盤でダンダルモンが待つ。砲台とレーザーをよけ、攻撃の終わりに反撃しよう。')])
map_page('5E','バブイルトレンドセンター37F','右の外壁エレベーターから、さらに上へ。',[('上昇前に体力を整えよう','敵をまとめて、障害物や箱を調べる。拾い物の前に片側の敵を片づけると安全だ。'),('右側のエレベーターへ','この階も右へ進む。到着した上の階では進む向きが変わるので、乗り場の位置を覚えておこう。')])
map_page('5F','BTセンター99F','右のエレベーターから入り、左の通路へ。',[('出口は左！','右側は到着したエレベーター。敵を片づけたら左へ進んで、連絡通路に出よう。'),('セキュリティ室も探索','奥の扉には寄り道がある。室内では素早い相手の出現に注意し、追い回さず進路を読もう。')],[(480,'奥のセキュリティ室の扉で↑。帰りは入口側から。')])
map_page('5G','連絡通路','高い階の連絡通路。今度は左へ渡る。',[('さっきの通路と向きが違う','右のビルから左のビルへ向かう。到着側に戻らず、左端を目指そう。'),('窓枠に惑わされない','通路の奥行きは限られる。遠景やガラスの枠より、ミカと敵の足元を基準に位置を合わせる。')])
map_page('5H','VSビル99F','右から入って左へ。展望台行きは左端だ！',[('最後は超高速エレベーター','展望台へは普通の扉でなく、左のエレベーターから。上昇演出が始まったら、次の戦いに備えよう。'),('オフィスにも寄ってみよう','奥の入口で↑。隠し部屋から戻ったあとも、左へ進むことを忘れないように。')],[(480,'奥のオフィス入口。寄り道を終えたら左の乗り場へ。')])
map_page('5I','展望台','眺めは最高、待ち構える敵も最強級。右へ進もう。',[('秘宝を前に、油断するな','広い窓の前を右へ進む。奥の壁にある入口は隠し部屋へ。強敵に挑む前に武器と体力を整えたい。'),('予兆を見てレーザーを避けろ','最後に待つのはドクターS。詳しい戦い方は次のページで紹介する。')],[(591,'前半の奥の壁に扉がある。床ではなく、壁に寄って↑。')])
secret_gallery('ビルの隠し部屋 上', [('5A_H1','低層階・前半の扉'),('5A_H2','低層階・後半の扉'),('5A_H3','後半の部屋のさらに奥'),('5B_H1','会議室'),('5B_H2','会議室の奥')],8)
secret_gallery('ビルの隠し部屋 下', [('5F_H1','セキュリティ室'),('5H_H1','オフィス'),('5I_H1','展望台の奥の壁から')],8)
#33
base('展望台を独占する、怪しい円盤！','ドクターS特集','最終兵器 ウルトラマシーンS、その姿をじっくり拝見。')
sprite('ultra_machine_s',31,106,358,164)
greenname('窓の景色より、目立っているぞ。',24,290,372)
para('ようやくたどり着いた展望台で、ミカを迎えるのはドクターSの円盤。丸い機体に並ぶランプや装置は、どれもただの飾りではなさそうだ。こんな乗り物で景色を独占するとは、ずいぶんぜいたくな話である。',24,316,372,10.8,17)
greenname('床の光、空の光。大騒ぎの始まりだ！',24,409,372)
para('床を追う照準、まぶしいレーザー、飛び交う弾。のんびり観光するつもりなら大間違い。騒ぎの切れ目には円盤がすっと低くなり、ミカの拳が届くほど近づいてくる。いよいよ、旅の大きな山場だ。',24,435,372,10.8,17)
fullstrip('5I',24,523,372);end()
#34
base('その先は、君の目で確かめよう！','冒険の続き','本書の攻略はここまで。ゴブリン族の秘宝は、まだ明かさない。')
rect(24,106,372,272,NAVY);sprite('idle',47,223,83,113);sprite('robot_idle',302,270,61,67)
para('ドクターSを倒した\nその先で待つものは？',66,143,292,24,37,'#ffffff',True)
text('?',190,272,72,GOLD,True)
para('宝物庫に待つもの。\nミカとロボが最後に見る景色。\nそして、ゴブリン族の秘宝の正体。',37,405,350,14,25,NAVY,True)
para('このページをめくっても、答えは書いていない。\nコントローラーを握り直し、冒険の続きを始めよう！',37,500,350,11,18)
end()
interview_feature()

C.save()
(OUT/'page_titles.json').write_text(json.dumps(PAGES,ensure_ascii=False,indent=2))
(OUT/'MIKA_GUIDE_TEXT.txt').write_text('\n\n'.join(f'【{i+1:02d} {t}】\n{v}' for i,(t,v) in enumerate(zip(PAGES,TEXTS))))
print('Created',len(PAGES),'pages')
