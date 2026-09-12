const num=(value:string|null)=>{
  if(value===null)return null
  const text=value.trim()
  if(!text)return null
  const n=Number(text)
  return Number.isFinite(n)?n:null
}
const inRange=(lat:number|null,lon:number|null)=>lat!==null&&lon!==null&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180
const codeText=(code:number)=>({0:'Trời quang',1:'Chủ yếu quang',2:'Ít mây',3:'Nhiều mây',45:'Sương mù',48:'Sương mù đóng băng',51:'Mưa phùn nhẹ',53:'Mưa phùn',55:'Mưa phùn dày',61:'Mưa nhẹ',63:'Mưa vừa',65:'Mưa lớn',71:'Tuyết nhẹ',73:'Tuyết vừa',75:'Tuyết lớn',80:'Mưa rào nhẹ',81:'Mưa rào',82:'Mưa rào lớn',95:'Mưa dông',96:'Mưa dông kèm mưa đá',99:'Mưa dông mạnh'} as Record<number,string>)[code]||'Thời tiết biến đổi'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, x-client-info, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'86400'}
const json=(body:unknown,status=200,cache='public, max-age=300, s-maxage=600, stale-while-revalidate=1200')=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,'X-Content-Type-Options':'nosniff'}})

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='GET')return json({error:'Method not allowed'},405,'no-store')
  const requestUrl=new URL(req.url)
  const rawLat=requestUrl.searchParams.get('lat'),rawLon=requestUrl.searchParams.get('lon')
  const hasExplicitLocation=rawLat!==null||rawLon!==null
  let lat=num(rawLat),lon=num(rawLon),mode='unavailable'

  if(hasExplicitLocation){
    if(!inRange(lat,lon))return json({available:false,locationMode:'unavailable'})
    mode='GPS'
  }else{
    lat=num(req.headers.get('cf-iplatitude'))
    lon=num(req.headers.get('cf-iplongitude'))
    if(!inRange(lat,lon))return json({available:false,locationMode:'unavailable'})
    mode='IP'
  }

  try{
    const url=new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude',String(lat))
    url.searchParams.set('longitude',String(lon))
    url.searchParams.set('current','temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code')
    url.searchParams.set('timezone','auto')
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500)
    let response:Response
    try{response=await fetch(url,{headers:{'user-agent':'YHCT-HIU-4.0/1.0'},signal:controller.signal})}finally{clearTimeout(timer)}
    if(!response.ok)throw new Error(`weather ${response.status}`)
    const data=await response.json(),current=data.current||{}
    return json({available:true,temperature:current.temperature_2m,apparentTemperature:current.apparent_temperature,humidity:current.relative_humidity_2m,windSpeed:current.wind_speed_10m,condition:codeText(Number(current.weather_code)),locationMode:mode,observedAt:current.time,source:'Open-Meteo'})
  }catch(error){console.error('public-weather',String(error));return json({available:false,locationMode:mode})}
})