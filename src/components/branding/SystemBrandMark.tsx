import type { CSSProperties } from 'react';
import { AcupunctureIcon,DecoctionIcon,FiveElementsIcon,HerbIcon,MortarIcon,TaijiIcon } from '../icons/YhctIcons';

export type SystemBrandVariant='taiji'|'five'|'herb'|'decoction'|'mortar'|'acupuncture';

type Props={
  variant?:SystemBrandVariant;
  size?:number|string;
  className?:string;
  label?:string;
};

const icons={
  taiji:TaijiIcon,
  five:FiveElementsIcon,
  herb:HerbIcon,
  decoction:DecoctionIcon,
  mortar:MortarIcon,
  acupuncture:AcupunctureIcon
};

const APPROVED_LOGO='/club-yhct-logo.svg?v=20260916-logo1';

export default function SystemBrandMark({variant='taiji',size='100%',className='',label='YHCT HIU 4.0'}:Props){
  const style:CSSProperties={width:size,height:size};
  if(variant==='taiji'){
    return <span className={`system-brand-mark system-brand-mark--taiji ${className}`.trim()} style={style} role="img" aria-label={label}>
      <img src={APPROVED_LOGO} alt="" aria-hidden="true" style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
    </span>;
  }
  const Icon=icons[variant];
  return <span className={`system-brand-mark system-brand-mark--${variant} ${className}`.trim()} style={style} role="img" aria-label={label}>
    <span className="system-brand-mark__halo" aria-hidden="true"/>
    <Icon className="system-brand-mark__icon"/>
  </span>;
}
