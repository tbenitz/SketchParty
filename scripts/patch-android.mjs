// Apply Android TV launcher metadata to a freshly generated Capacitor project.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {deflateSync} from "node:zlib";
const base="android/app/src/main";
const manifestPath=base+"/AndroidManifest.xml";
let xml=await readFile(manifestPath,"utf8");
if(!xml.includes("android.software.leanback")){
  xml=xml.replace("<application",[
    '<uses-feature android:name="android.software.leanback" android:required="false" />',
    '<uses-feature android:name="android.hardware.touchscreen" android:required="false" />',
    '<application'
  ].join("\n    "));
}
if(!xml.includes('android:banner="@drawable/tv_banner"')){
  xml=xml.replace("<application",'<application android:banner="@drawable/tv_banner"');
}
if(!xml.includes("android.intent.category.LEANBACK_LAUNCHER")){
  xml=xml.replace('<category android:name="android.intent.category.LAUNCHER" />',
    '<category android:name="android.intent.category.LAUNCHER" />\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />');
}
if(!xml.includes('android.permission.INTERNET')){
  xml=xml.replace("<application",'<uses-permission android:name="android.permission.INTERNET" />\n    <application');
}
await writeFile(manifestPath,xml);
// Create a valid 320x180 TV banner PNG using built-in Node only (no extra dependencies).
const W=320,H=180;
const rgba=Buffer.alloc((W*4+1)*H);
for(let y=0;y<H;y++){
  const row=y*(W*4+1);
  for(let x=0;x<W;x++){
    const off=row+1+x*4;
    const gold=Math.hypot((x-160)/1.3,(y-90)*1.25)<57;
    const center=Math.hypot(x-161,y-88)<30;
    rgba[off]=gold?(center?250:255):Math.round(17+x/W*13);
    rgba[off+1]=gold?(center?198:211):Math.round(24+y/H*20);
    rgba[off+2]=gold?(center?82:112):Math.round(44+x/W*18);
    rgba[off+3]=255;
  }
}
function crc32(buf){
  let crc=0xffffffff;
  for(const b of buf){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
  const name=Buffer.from(type,"ascii");
  const n=Buffer.alloc(4);n.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([n,name,data,crc]);
}
const ihdr=Buffer.alloc(13);
ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",deflateSync(rgba)),chunk("IEND",Buffer.alloc(0))]);
await mkdir(base+"/res/drawable",{recursive:true});
await writeFile(base+"/res/drawable/tv_banner.png",png);
console.log("Installed TV launcher intent, non-touch features and banner image.");
