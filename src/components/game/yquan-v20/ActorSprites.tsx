import DoctorMasterSprite from './DoctorMasterSprite';
import type {DoctorGender,DoctorOutfit} from './types';

function PatientMouthRig(){
  return <g className="mouth-rig patient-mouth-rig" aria-hidden="true">
    <path className="mouth-pose mouth-closed" d="M82 105q13 9 26 0" fill="none" stroke="#a95d5a" strokeWidth="3" strokeLinecap="round"/>
    <g className="mouth-pose mouth-small"><ellipse cx="95" cy="109" rx="12" ry="6" fill="#783038" stroke="#9f5453" strokeWidth="2"/><path d="M87 106.5q8 3 16 0" fill="none" stroke="#fff7eb" strokeWidth="2" strokeLinecap="round"/></g>
    <g className="mouth-pose mouth-wide"><path d="M80 104q15-4 30 0v4q-2 15-15 16-13-1-15-16z" fill="#742d35" stroke="#9f5453" strokeWidth="2"/><path d="M85 105.5q10 4 20 0" fill="none" stroke="#fff7eb" strokeWidth="2.6" strokeLinecap="round"/><path d="M89 118q6-3 12 0" fill="none" stroke="#df7b7d" strokeWidth="2.7" strokeLinecap="round"/></g>
    <ellipse className="mouth-pose mouth-o" cx="95" cy="110" rx="7.5" ry="9" fill="#733038" stroke="#9f5453" strokeWidth="2"/>
  </g>;
}

export function DoctorSprite({gender}:{gender:DoctorGender;outfit:DoctorOutfit}){
  return <DoctorMasterSprite gender={gender}/>;
}

const patientPalette=(gender:DoctorGender,age:number,variant:number)=>{
  const senior=age>=60,child=age<13;
  const palettes=gender==='female'?['#8952a0','#b65465','#3d806e']:['#4b7b94','#7b5b42','#3e735b'];
  return {hair:senior?'#c9c7c5':variant===2?'#40302b':'#6a3c2b',body:palettes[(Math.max(1,Math.min(3,variant))-1)],bottom:child?'#d7a6a9':'#514b47'};
};

export function PatientSprite({gender,age,variant=1}:{gender:DoctorGender;age:number;variant?:number}){
  const p=patientPalette(gender,age,variant),senior=age>=60,child=age<13;
  return <svg className="hyq-v20-patient-svg" viewBox="0 0 190 280" role="img" aria-label={`Bệnh nhân ${gender==='female'?'nữ':'nam'}, ${age} tuổi`}>
    <ellipse cx="95" cy="258" rx="48" ry="10" fill="rgba(33,30,24,.16)"/>
    <g className="patient-body"><path d="M54 131q41-18 82 0l10 91H44z" fill={p.body} stroke="#4d3028" strokeWidth="4"/><path d="M58 215h34v38H53zm45 0h34l5 38h-39z" fill={p.bottom} stroke="#4d3028" strokeWidth="4"/><g className="patient-arm left"><path d="M55 145q-22 19-8 45l17-8 7-31" fill={p.body} stroke="#4d3028" strokeWidth="4"/><circle cx="47" cy="191" r="10" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/></g><g className="patient-arm right"><path d="M135 145q22 19 8 45l-17-8-7-31" fill={p.body} stroke="#4d3028" strokeWidth="4"/><circle cx="143" cy="191" r="10" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/></g></g>
    <g className="patient-head"><ellipse cx="95" cy="82" rx="54" ry="51" fill="#ffd8bd" stroke="#4d3028" strokeWidth="4"/><path d={gender==='female'?'M43 72Q42 25 95 22q51 1 53 48-17-21-45-26-31 18-60 28z':'M44 70Q48 26 95 24q45 1 51 43-22-17-43-20-32 16-59 23z'} fill={p.hair} stroke="#4d3028" strokeWidth="4"/>{gender==='female'&&!senior&&<circle cx="140" cy="65" r="13" fill={p.hair} stroke="#4d3028" strokeWidth="3"/>}<ellipse cx="73" cy="84" rx={senior?5:7} ry={senior?5:10} fill="#46251e"/><ellipse cx="117" cy="84" rx={senior?5:7} ry={senior?5:10} fill="#46251e"/><PatientMouthRig/>{senior&&<path d="M61 73q11-9 23 0m22 0q12-9 23 0" fill="none" stroke="#777" strokeWidth="2"/>}</g>
    <g className="pain-mark"><path d="M154 73l12-14 2 15 13-6-8 19" fill="none" stroke="#b8493f" strokeWidth="5" strokeLinecap="round"/></g>
    <g className="happy-mark"><path d="M153 60c8-15 27-4 16 10-7 8-16 14-16 14s-9-7-15-15c-9-13 8-23 15-9z" fill="#e56f75"/></g>
    {child&&<path d="M67 135q28 22 56 0" fill="none" stroke="#f2c579" strokeWidth="5"/>}
  </svg>;
}
