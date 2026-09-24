import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFile,writeFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/club-yhct-logo.svg',import.meta.url));
const logo=await loadImage(source);

async function render(path,size,{inset=0,background=null}={}){
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  if(background){
    ctx.fillStyle=background;
    ctx.fillRect(0,0,size,size);
  }
  const drawSize=size-inset*2;
  ctx.drawImage(logo,inset,inset,drawSize,drawSize);
  await writeFile(new URL(`../public/${path}`,import.meta.url),canvas.toBuffer('image/png'));
}

await render('pwa-icon-192.png',192);
await render('pwa-icon-512.png',512);
await render('pwa-maskable-512.png',512,{inset:64,background:'#FFF8EF'});
console.log('Brand icons generated without forced white tile: 192, 512, maskable 512.');
