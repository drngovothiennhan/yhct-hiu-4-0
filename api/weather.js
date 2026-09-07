const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const codeText=c=>({0:'Trời quang',1:'Chủ yếu quang',2:'Ít mây',3:'Nhiều mây',45:'Sương mù',48:'Sương mù đóng băng',51:'Mưa phùn nhẹ',53:'Mưa phùn',55:'Mưa phùn dày',61:'Mưa nhẹ',63:'Mưa vừa',65:'Mưa lớn',71:'Tuyết nhẹ',73:'Tuyết vừa',75:'Tuyết lớn',80:'Mưa rào nhẹ',81:'Mưa rào',82:'Mưa rào lớn',95:'Mưa dông',96:'Mưa dông kèm mưa đá',99:'Mưa dông mạnh'})[c]||'Thời tiết biến đổi';

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=600, stale-while-revalidate=1200');
  const requestUrl=new URL(req.url||'/','https://yhct.local');
  let lat=num(requestUrl.searchParams.get('lat')),lon=num(requestUrl.searchParams.get('lon')),mode='GPS';
  if(lat===null||lon===null){lat=num(req.headers['x-vercel-ip-latitude']);lon=num(req.headers['x-vercel-ip-longitude']);mode='IP'}
  if(lat===null||lon===null||lat<-90||lat>90||lon<-180||lon>180)return res.status(200).json({available:false,locationMode:'unavailable'});
  try{
    const u=new URL('https://api.open-meteo.com/v1/forecast');
    u.searchParams.set('latitude',String(lat));
    u.searchParams.set('longitude',String(lon));
    u.searchParams.set('current','temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code');
    u.searchParams.set('timezone','auto');
    const r=await fetch(u,{headers:{'user-agent':'YHCT-HIU-4.0/1.0'}});
    if(!r.ok)throw new Error(`weather ${r.status}`);
    const j=await r.json(),c=j.current||{};
    return res.status(200).json({available:true,temperature:c.temperature_2m,apparentTemperature:c.apparent_temperature,humidity:c.relative_humidity_2m,windSpeed:c.wind_speed_10m,condition:codeText(Number(c.weather_code)),locationMode:mode,observedAt:c.time,source:'Open-Meteo'})
  }catch(e){
    console.error('weather',String(e));
    return res.status(200).json({available:false,locationMode:mode})
  }
}
