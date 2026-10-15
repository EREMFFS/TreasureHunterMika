import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path('guide');D=json.load(open(R/'extracted/data.json'));O=R/'refs_v3';O.mkdir(exist_ok=True)
sets={
'weapons':['item_katana','item_war_axe','item_gungnir','item_battle_hammer','item_wave_cannon','item_machinegun','item_rocket_launcher','item_yoichi_bow','item_flamethrower','item_rocket_punch','aegis_shield_00','chest_good'],
'items':['item_'+x['id'] for x in D['REF']['treasure']['items'] if x['id'] not in ['apple','chocolate']]+['item_chocolate','item_apple','item_potion','item_high_potion','item_elixir','chest_weak','chest_high','chest_rare'],
'monsters':['goblin','hobgoblin','death_goblin','dark_goblin','skeleton','deathhound','ogre','ograst','big_ogre','ogyar','gigas','hill_gigas','yor_gigas','papa_gigas','mega_goblin','megamega','tsugira','kaon','ashiin']}
for typ,keys in sets.items():
 rows=(len(keys)+3)//4;sheet=Image.new('RGB',(1000,rows*240),'white');dr=ImageDraw.Draw(sheet)
 for i,k in enumerate(keys):
  key=k
  if typ=='monsters':
   key=k+'_idle'
   if key not in D['ATLAS']['frames'] and key not in D['ANIMS']:
    family=D['REF']['monsters'].get(k,{}).get('family',k);key=family+'_idle'
  if key not in D['ATLAS']['frames']:key=D['ANIMS'].get(key,{}).get('frames',[key])[0]
  pg,x,y,w,h,tx,ty,cw,ch=D['ATLAS']['frames'][key];im=Image.open(R/f'extracted/atlas_{pg}.png').convert('RGBA').crop((x,y,x+w,y+h));scale=min(205/im.width,195/im.height);im=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.NEAREST)
  xx=i%4*250;yy=i//4*240;sheet.paste(im,(xx+(250-im.width)//2,yy+12+(195-im.height)//2),im);dr.text((xx+8,yy+216),str(i+1)+' '+k,fill='black')
 sheet.save(O/f'{typ}.png')
(R/'refs_v3/sets.json').write_text(json.dumps(sets))
