import {useId} from 'react';
import type {DoctorGender} from './types';
import {DOCTOR_MASTERS} from './DoctorMasterRig';

export default function DoctorMasterSprite({gender}:{gender:DoctorGender}){
  const id=useId().replace(/:/g,'');
  const master=DOCTOR_MASTERS[gender];
  return <svg className="hyq-v20-doctor-svg hyq-master-doctor" viewBox={master.viewBox} data-master-gender={gender} role="img" aria-label={`Thầy thuốc ${gender==='female'?'nữ':'nam'}`}>
    <defs>{master.layers.map(layer=><clipPath key={layer.part} id={`${id}-${layer.part}`} clipPathUnits="userSpaceOnUse"><path d={layer.outline}/></clipPath>)}</defs>
    <g data-master-body="true">{master.layers.map(layer=><g key={layer.part} data-master-part={layer.part}>
      <image href={master.source} x="0" y="0" width="1536" height="1536" clipPath={`url(#${id}-${layer.part})`}/>
    </g>)}</g>
  </svg>;
}
