import {mkdir,cp,copyFile,rm} from "node:fs/promises";
await rm("www",{recursive:true,force:true});
await mkdir("www/js",{recursive:true});
await Promise.all([
  copyFile("tv.html","www/index.html"),
  copyFile("tv.html","www/tv.html"),
  copyFile("style.css","www/style.css"),
  copyFile("words.json","www/words.json"),
  cp("js","www/js",{recursive:true})
]);
console.log("Prepared www/ assets for Android package.");
