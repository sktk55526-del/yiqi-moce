'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),site=require('../package.json').name==='yiqi-moce-pwa'||fs.existsSync(path.join(root,'.openai/hosting.json'))?root:path.join(root,'pwa-site'),out=path.join(site,'dist');
const config=require('../pwa/config'),debug=process.argv.includes('--debug');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
if(!/^wss:\/\//.test(config.socketUrl))throw new Error('Secure WebSocket required');
if(fs.existsSync(out)){
  if(fs.realpathSync(out)!==out||path.relative(site,out)!=='dist')throw new Error('Unexpected output directory');
  fs.rmSync(out,{recursive:true,force:true});
}
fs.mkdirSync(out,{recursive:true});
for(const dir of ['assets','ui-art','table-fx','table-themes','table-music']){
  fs.mkdirSync(path.join(out,dir),{recursive:true});
  for(const name of fs.readdirSync(path.join(root,'minigame',dir)))if(/\.(png|jpg|wav|mp3|ttf)$/.test(name))fs.copyFileSync(path.join(root,'minigame',dir,name),path.join(out,dir,name));
}
fs.cpSync(path.join(root,'pwa/icons'),path.join(out,'icons'),{recursive:true});
const result=esbuild.buildSync({absWorkingDir:root,entryPoints:['pwa/entry.js'],bundle:true,write:false,minify:!debug,
  platform:'browser',target:['safari15','chrome90'],define:{MOCE_PWA_DEBUG:String(debug)}});
const bundle=result.outputFiles[0].contents,name='game-'+digest(bundle)+'.js';fs.writeFileSync(path.join(out,name),bundle);
const html=fs.readFileSync(path.join(root,'pwa/index.html'),'utf8').replace('__BUNDLE__',name);fs.writeFileSync(path.join(out,'index.html'),html);
for(const file of ['app.css','boot.js'])fs.copyFileSync(path.join(root,'pwa',file),path.join(out,file));
fs.writeFileSync(path.join(out,'manifest.webmanifest'),JSON.stringify({id:'./',name:'一起抹车',short_name:'一起抹车',lang:'zh-CN',description:'广东纸牌，好友同桌。安卓和苹果手机桌面版。',
  start_url:'./?source=homescreen',scope:'./',display:'standalone',orientation:'portrait',theme_color:'#062d24',background_color:'#062d24',
  icons:[{src:'./icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'./icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'./icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,2));
function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=list(out).sort(),hash=crypto.createHash('sha256');for(const f of files){hash.update(path.relative(out,f));hash.update(fs.readFileSync(f));}
hash.update(fs.readFileSync(path.join(root,'pwa/sw.js')));
const cache=config.version+'-'+hash.digest('hex').slice(0,16);
fs.writeFileSync(path.join(out,'sw.js'),fs.readFileSync(path.join(root,'pwa/sw.js'),'utf8').replace('__CACHE__',JSON.stringify(cache)).replace('__FILES__',JSON.stringify(files.map(f=>'./'+path.relative(out,f).replaceAll('\\','/')))));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'_headers'),'/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n  Service-Worker-Allowed: /\n/index.html\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Cache-Control: no-cache\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log(JSON.stringify({version:config.version,debug,files:files.length,bytes:files.reduce((n,f)=>n+fs.statSync(f).size,0),bundle:name,cache,output:out}));
