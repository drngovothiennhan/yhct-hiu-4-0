export type WeatherSnapshot={
  temperature:number;
  apparentTemperature:number|null;
  humidity:number|null;
  windSpeed:number|null;
  condition:string;
  locationMode:'IP'|'GPS';
  observedAt:string|null;
  source:'Open-Meteo';
};

type WeatherResponse={
  available?:boolean;
  temperature?:unknown;
  apparentTemperature?:unknown;
  humidity?:unknown;
  windSpeed?:unknown;
  condition?:unknown;
  locationMode?:unknown;
  observedAt?:unknown;
  source?:unknown;
};

const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;

export async function fetchApproxWeather():Promise<WeatherSnapshot|null>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),5500);
  try{
    const response=await fetch('/api/weather',{headers:{Accept:'application/json'},signal:controller.signal});
    if(!response.ok)return null;
    const data=await response.json() as WeatherResponse;
    const temperature=finite(data.temperature);
    const mode=data.locationMode==='IP'||data.locationMode==='GPS'?data.locationMode:null;
    if(data.available!==true||temperature===null||!mode||data.source!=='Open-Meteo')return null;
    return {
      temperature,
      apparentTemperature:finite(data.apparentTemperature),
      humidity:finite(data.humidity),
      windSpeed:finite(data.windSpeed),
      condition:typeof data.condition==='string'&&data.condition.trim()?data.condition.trim():'Thời tiết biến đổi',
      locationMode:mode,
      observedAt:typeof data.observedAt==='string'?data.observedAt:null,
      source:'Open-Meteo',
    };
  }catch{return null}
  finally{window.clearTimeout(timer)}
}
