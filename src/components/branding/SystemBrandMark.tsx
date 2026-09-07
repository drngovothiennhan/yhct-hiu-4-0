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

export default function SystemBrandMark({variant='taiji',size='100%',className='',label='YHCT HIU 4.0'}:Props){
  const Icon=icons[variant];
  const style:CSSProperties={width:size,height:size};
  return <span className={`system-brand-mark system-brand-mark--${variant} ${className}`.trim()} style={style} role="img" aria-label={label}>
    <span className="system-brand-mark__halo" aria-hidden="true"/>
    <Icon className="system-brand-mark__icon"/>
  </span>;
}
