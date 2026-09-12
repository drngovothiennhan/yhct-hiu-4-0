import fs from 'node:fs';
import handler from '../api/weather.js';

const need=(ok,message)=>{if(!ok)throw new Error(message);console.log(`PASS ${message}`)};
const makeRes=()=>({
  statusCode:200,
  headers:{},
  body:null,
  setHeader(name,value){this.headers[name]=value},
  status(code){this.statusCode=code;return this},
  json(value){this.body=value;return this},
});
const run=async(url,headers={})=>{const res=makeRes();await handler({url,headers},res);return res};

const originalFetch=globalThis.fetch;
let calls=[];
globalThis.fetch=async(input)=>{
  calls.push(String(input));
  return new Response(JSON.stringify({current:{temperature_2m:31.2,apparent_temperature:35.1,relative_humidity_2m:72,wind_speed_10m:8.4,weather_code:2,time:'2026-09-12T08:00'}}),{status:200,headers:{'content-type':'application/json'}});
};

try{
  calls=[];
  const absent=await run('/api/weather');
  need(absent.statusCode===200&&absent.body?.available===false&&absent.body?.locationMode==='unavailable','missing coordinates fail closed instead of becoming zero-zero');
  need(calls.length===0,'missing coordinates do not call weather provider');

  calls=[];
  const empty=await run('/api/weather?lat=&lon=');
  need(empty.body?.available===false&&empty.body?.locationMode==='unavailable','empty explicit coordinates fail closed');
  need(calls.length===0,'empty explicit coordinates do not fall back silently');

  calls=[];
  const ip=await run('/api/weather',{'x-vercel-ip-latitude':'10.77','x-vercel-ip-longitude':'106.70'});
  need(ip.body?.available===true&&ip.body?.locationMode==='IP'&&ip.body?.source==='Open-Meteo','regional IP headers produce explicitly labelled IP weather');
  need(calls.length===1&&calls[0].includes('latitude=10.77')&&calls[0].includes('longitude=106.7'),'IP weather forwards only validated regional coordinates');

  calls=[];
  const gps=await run('/api/weather?lat=10.8&lon=106.6',{'x-vercel-ip-latitude':'1','x-vercel-ip-longitude':'2'});
  need(gps.body?.available===true&&gps.body?.locationMode==='GPS','complete explicit coordinates remain GPS mode');
  need(calls.length===1&&calls[0].includes('latitude=10.8')&&calls[0].includes('longitude=106.6'),'explicit coordinates take precedence over IP headers');

  calls=[];
  const partial=await run('/api/weather?lat=10.8');
  need(partial.body?.available===false&&calls.length===0,'partial explicit location is rejected instead of mixing sources');
}finally{globalThis.fetch=originalFetch}

const home=fs.readFileSync('src/components/home/StudentHome.tsx','utf8');
const service=fs.readFileSync('src/services/weatherService.ts','utf8');
const edge=fs.readFileSync('supabase/functions/public-weather/index.ts','utf8');
need(home.includes('fetchApproxWeather')&&home.includes('THỜI TIẾT KHU VỰC'),'Home renders fail-soft regional weather when available');
need(home.includes('ước tính theo khu vực mạng')&&home.includes('Open-Meteo'),'Home labels approximation and source context');
need(!home.includes('navigator.geolocation')&&!service.includes('navigator.geolocation'),'Home weather never requests device GPS implicitly');
need(service.includes("fetch('/api/weather'")&&!service.includes('?lat=')&&!service.includes('?lon='),'Home client uses regional backend without sending precise coordinates');
need(edge.includes("if(value===null)return null")&&edge.includes("mode='IP'")&&edge.includes('hasExplicitLocation'),'Edge weather fallback mirrors fail-closed coordinate handling');
console.log('Weather privacy, source and coordinate regression passed.');
