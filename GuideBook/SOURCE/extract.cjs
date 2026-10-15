const fs=require('fs'),vm=require('vm'),path=require('path');
const base=path.resolve('guide/game/game');const c={MIKA:{}};c.window=c;vm.createContext(c);
const files=[...fs.readFileSync(base+'/index.html','utf8').matchAll(/<script src="data\/([^\"]+)"/g)].map(x=>x[1]).filter(x=>!['audio.js','se_embed.js','jpfont.js','pxfont.js'].includes(x));
for(const f of files){try{vm.runInContext(fs.readFileSync(base+'/data/'+f,'utf8'),c)}catch(e){console.log(f,e.message)}}
const M=c.MIKA;fs.mkdirSync('guide/extracted',{recursive:true});
for(let i=0;i<M.ATLAS_PAGES.length;i++){const u=M.ATLAS_PAGES[i];if(typeof u==='string')fs.writeFileSync(`guide/extracted/atlas_${i}.png`,Buffer.from(u.split(',')[1],'base64'));}
for(const [k,v] of Object.entries(M.BG)){if(v.file?.startsWith('data:image')){fs.writeFileSync(`guide/extracted/bg_${k}.png`,Buffer.from(v.file.split(',')[1],'base64'));v.local=`guide/extracted/bg_${k}.png`;}else v.local='guide/game/game/'+v.file;}
delete M.ATLAS_PAGES;fs.writeFileSync('guide/extracted/data.json',JSON.stringify(M));
console.log('keys',Object.keys(M));console.log('ref',Object.keys(M.REF));console.log('anims',Object.keys(M.ANIMS).join(','));
