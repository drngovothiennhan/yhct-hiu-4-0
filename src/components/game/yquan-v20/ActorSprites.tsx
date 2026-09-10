import type {DoctorGender,DoctorOutfit} from './types';

const outfitPalette:Record<DoctorOutfit,{coat:string;inner:string;accent:string;bottom:string}>={
  classic:{coat:'#f8fbfa',inner:'#245c4f',accent:'#d8a553',bottom:'#40515b'},
  academy:{coat:'#effaf7',inner:'#58a991',accent:'#cf9f4a',bottom:'#2f4d52'},
  master:{coat:'#f7efe3',inner:'#7b3f32',accent:'#b78b55',bottom:'#4b413d'}
};

function DoctorMouthRig(){
  return <g className="mouth-rig doctor-mouth-rig" aria-hidden="true">
    <path className="mouth-pose mouth-closed" d="M91 108q14 10 28 0" fill="none" stroke="#b35c58" strokeWidth="3" strokeLinecap="round"/>
    <g className="mouth-pose mouth-small"><ellipse cx="105" cy="112" rx="13" ry="6.5" fill="#7c3138" stroke="#a94f55" strokeWidth="2"/><path d="M96 109q9 3 18 0" fill="none" stroke="#fff8ed" strokeWidth="2.2" strokeLinecap="round"/></g>
    <g className="mouth-pose mouth-wide"><path d="M89 107q16-5 32 0v4q-2 16-16 17-14-1-16-17z" fill="#762e35" stroke="#a94f55" strokeWidth="2"/><path d="M94 108q11 4 22 0" fill="none" stroke="#fff8ed" strokeWidth="3" strokeLinecap="round"/><path d="M98 122q7-4 14 0" fill="none" stroke="#e88484" strokeWidth="3" strokeLinecap="round"/></g>
    <ellipse className="mouth-pose mouth-o" cx="105" cy="113" rx="8" ry="10" fill="#733038" stroke="#a94f55" strokeWidth="2.2"/>
  </g>;
}

function PatientMouthRig(){
  return <g className="mouth-rig patient-mouth-rig" aria-hidden="true">
    <path className="mouth-pose mouth-closed" d="M82 105q13 9 26 0" fill="none" stroke="#a95d5a" strokeWidth="3" strokeLinecap="round"/>
    <g className="mouth-pose mouth-small"><ellipse cx="95" cy="109" rx="12" ry="6" fill="#783038" stroke="#9f5453" strokeWidth="2"/><path d="M87 106.5q8 3 16 0" fill="none" stroke="#fff7eb" strokeWidth="2" strokeLinecap="round"/></g>
    <g className="mouth-pose mouth-wide"><path d="M80 104q15-4 30 0v4q-2 15-15 16-13-1-15-16z" fill="#742d35" stroke="#9f5453" strokeWidth="2"/><path d="M85 105.5q10 4 20 0" fill="none" stroke="#fff7eb" strokeWidth="2.6" strokeLinecap="round"/><path d="M89 118q6-3 12 0" fill="none" stroke="#df7b7d" strokeWidth="2.7" strokeLinecap="round"/></g>
    <ellipse className="mouth-pose mouth-o" cx="95" cy="110" rx="7.5" ry="9" fill="#733038" stroke="#9f5453" strokeWidth="2"/>
  </g>;
}

export function DoctorSprite({gender,outfit}:{gender:DoctorGender;outfit:DoctorOutfit}){
  const p=outfitPalette[outfit],female=gender==='female';
  return <svg className="hyq-v20-doctor-svg" viewBox="0 0 210 300" role="img" aria-label={`Thầy thuốc ${female?'nữ':'nam'}`}>
    <g className="shadow"><ellipse cx="105" cy="278" rx="54" ry="12" fill="rgba(33,30,24,.18)"/></g>
    <g className="body-group">
      <g className="leg left-leg"><path d="M72 222h29v48H67z" fill={p.bottom} stroke="#4d3028" strokeWidth="4" strokeLinejoin="round"/><path d="M65 264h38v15H60q-5-8 5-15z" fill="#edf1ef" stroke="#4d3028" strokeWidth="4"/></g>
      <g className="leg right-leg"><path d="M109 222h29l5 48h-34z" fill={p.bottom} stroke="#4d3028" strokeWidth="4" strokeLinejoin="round"/><path d="M108 264h39q10 7 4 15h-43z" fill="#edf1ef" stroke="#4d3028" strokeWidth="4"/></g>
      <path className="coat" d="M58 136q47-24 94 0l15 104H43z" fill={p.coat} stroke="#4d3028" strokeWidth="4" strokeLinejoin="round"/>
      <path className="inner" d="M84 134h42l10 96H74z" fill={p.inner}/>
      {!female&&<path className="tie" d="M101 135h10l8 61-13 17-13-17z" fill="#205a4e"/>}
      {female&&<path className="dress-line" d="M82 144h47M78 209h57" stroke={p.accent} strokeWidth="5" opacity=".9"/>}
      <path className="lapel-left" d="M63 139l32 8-20 57" fill={p.coat} stroke="#69837b" strokeWidth="3"/>
      <path className="lapel-right" d="M147 139l-32 8 20 57" fill={p.coat} stroke="#69837b" strokeWidth="3"/>
      <g className="arm left-arm"><path d="M59 147q-32 23-25 58l26-7 15-40z" fill={p.coat} stroke="#4d3028" strokeWidth="4"/><ellipse className="left-hand" cx="40" cy="205" rx="12" ry="10" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/></g>
      <g className="arm right-arm"><path d="M151 147q32 23 25 58l-26-7-15-40z" fill={p.coat} stroke="#4d3028" strokeWidth="4"/><ellipse className="right-hand" cx="170" cy="205" rx="12" ry="10" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/></g>
      <g className="stethoscope" fill="none" stroke="#326458" strokeWidth="5" strokeLinecap="round"><path d="M82 144v25q0 20 16 20t16-20v-25"/><path d="M136 146v38"/><circle cx="136" cy="192" r="8" fill="#dbe9e7"/></g>
      <g className="clipboard"><rect x="145" y="176" width="37" height="47" rx="5" fill="#3d7764" stroke="#294d43" strokeWidth="3"/><path d="M153 188h21m-21 9h18m-18 9h14" stroke="#eaf4f1" strokeWidth="2"/></g>
      <g className="herb-prop"><path d="M158 190q11-18 19-5-4 11-16 14" fill="#5e9e67" stroke="#35583a" strokeWidth="3"/><path d="M161 197q-4-18 8-20" fill="none" stroke="#35583a" strokeWidth="3"/></g>
      <g className="mortar-prop"><path d="M145 205h35l-5 20h-25z" fill="#c9a46e" stroke="#5a4332" strokeWidth="3"/><path d="M160 205l15-30" stroke="#7c5b3f" strokeWidth="6" strokeLinecap="round"/></g>
      <g className="package-prop"><rect x="149" y="195" width="29" height="32" rx="3" fill="#e6d0a7" stroke="#795838" strokeWidth="3"/><path d="M149 204h29" stroke="#b34e3b" strokeWidth="3"/></g>
    </g>
    <g className="head-group">
      {female&&<circle className="bun" cx="128" cy="34" r="23" fill="#6a3c2b" stroke="#4d3028" strokeWidth="4"/>}
      <ellipse className="ear left-ear" cx="54" cy="91" rx="11" ry="16" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/>
      <ellipse className="ear right-ear" cx="156" cy="91" rx="11" ry="16" fill="#ffd8bd" stroke="#4d3028" strokeWidth="3"/>
      <ellipse className="face" cx="105" cy="84" rx="58" ry="55" fill="#ffd8bd" stroke="#4d3028" strokeWidth="4"/>
      <path className="hair" d={female?'M48 77Q45 24 105 21q58 2 61 57-17-24-48-31-34 18-70 30z':'M50 76Q51 26 104 24q52 1 58 49-20-21-45-25-31 19-67 28z'} fill="#6a3c2b" stroke="#4d3028" strokeWidth="4" strokeLinejoin="round"/>
      {female&&<><path d="M52 72q-17 50 7 81l19-22-8-58z" fill="#6a3c2b" stroke="#4d3028" strokeWidth="4"/><path d="M158 72q17 50-7 81l-19-22 8-58z" fill="#6a3c2b" stroke="#4d3028" strokeWidth="4"/></>}
      <g className="eyes"><ellipse cx="82" cy="86" rx="8" ry="12" fill="#46251e"/><ellipse cx="128" cy="86" rx="8" ry="12" fill="#46251e"/><circle cx="79" cy="82" r="2.5" fill="white"/><circle cx="125" cy="82" r="2.5" fill="white"/></g>
      <DoctorMouthRig/>
      <ellipse cx="66" cy="105" rx="9" ry="5" fill="#f49c98" opacity=".42"/><ellipse cx="144" cy="105" rx="9" ry="5" fill="#f49c98" opacity=".42"/>
    </g>
    <g className="thought"><circle cx="175" cy="66" r="7" fill="#fff5c9"/><circle cx="187" cy="52" r="10" fill="#fff5c9"/><path d="M178 35h18M187 26v18" stroke="#b28a42" strokeWidth="4" strokeLinecap="round"/></g>
  </svg>;
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
