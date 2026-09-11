import type {ActorAnimation,DoctorGender} from './types';

export type MasterPart='hairBack'|'leftLeg'|'rightLeg'|'torso'|'leftArm'|'rightArm'|'head';
export interface MasterLayer{part:MasterPart;outline:string;pivot:[number,number]}
export interface DoctorMaster{source:string;viewBox:string;layers:MasterLayer[]}

// Every layer samples the same unchanged original JPEG. No regenerated face,
// alternate palette or independent per-animation character artwork is used.
export const DOCTOR_MASTERS:Record<DoctorGender,DoctorMaster>={
  male:{source:'/assets/hiu-y-quan/characters/master/doctor-male-original.jpg',viewBox:'330 110 880 1260',layers:[
    {part:'leftLeg',pivot:[705,1170],outline:'M647 1188L770 1188L766 1260L739 1313Q739 1344 700 1351L642 1352Q617 1341 635 1318L656 1292Z'},
    {part:'rightLeg',pivot:[820,1170],outline:'M767 1170L880 1170L900 1299L917 1327Q927 1352 895 1355L857 1354Q827 1351 824 1332L817 1302Z'},
    {part:'torso',pivot:[760,830],outline:'M697 814L837 814L882 866L906 1018L930 1080L959 1191Q968 1220 873 1226L840 1218L820 1141L788 1108L759 1138L730 1219L645 1224L588 1210L587 1171L612 1043L643 894Z'},
    {part:'leftArm',pivot:[673,879],outline:'M669 862L704 913L651 1008L602 1087L590 1102L575 1118L558 1113L549 1100Q521 1114 522 1084L532 1050L543 1028L588 960L635 891Z'},
    {part:'rightArm',pivot:[864,873],outline:'M835 829L883 867L940 939L977 991Q992 1018 977 1040L937 1087L917 1075L893 1064L865 1084L837 1083L838 1070L872 1050L908 1001L866 953Z'},
    {part:'head',pivot:[765,799],outline:'M369 437Q403 421 419 371Q440 309 499 281L579 272Q573 211 609 174L638 157L624 185L615 208Q675 149 741 145Q878 140 980 235Q1069 250 1105 331L1078 321Q1146 413 1132 523Q1132 586 1083 634Q1105 659 1087 697Q1075 733 1030 733L995 727Q969 784 893 809L835 818L800 842L757 852L716 830Q632 830 554 794L525 765L506 718Q452 724 446 674Q444 640 466 621Q405 573 405 503L415 440Z'}
  ]},
  female:{source:'/assets/hiu-y-quan/characters/master/doctor-female-original.jpg',viewBox:'400 200 850 1190',layers:[
    {part:'hairBack',pivot:[969,724],outline:'M948 711Q1016 727 1048 776L1067 859L1072 922L1087 970Q1024 989 976 943L946 888L920 824Z'},
    {part:'leftLeg',pivot:[717,1290],outline:'M682 1284L758 1284L753 1343L751 1363L693 1363L688 1336Z'},
    {part:'rightLeg',pivot:[791,1290],outline:'M765 1286L831 1286L816 1338L825 1362L770 1362L766 1341Z'},
    {part:'torso',pivot:[759,824],outline:'M641 805L857 805L898 851L901 977L884 1065L916 1174L943 1291Q863 1314 753 1308Q660 1307 581 1288L593 1226L608 1134L601 1016L578 926L602 861Z'},
    {part:'leftArm',pivot:[622,862],outline:'M609 853L655 856L662 913L684 930L653 1147L639 1158L485 1118L496 1044Q474 1030 480 1009L493 992L508 905L566 918L581 894Z'},
    {part:'rightArm',pivot:[882,846],outline:'M860 817L903 836L970 844L1129 834L1154 815L1169 782Q1185 764 1196 780L1195 812Q1209 820 1204 840Q1220 848 1208 865Q1224 881 1205 900L1173 903L1152 893L1121 910Q999 949 922 919L892 904Z'},
    {part:'head',pivot:[753,795],outline:'M450 554Q437 478 455 410Q481 318 564 267Q637 219 716 224L761 227Q843 211 922 258Q1045 321 1042 467L1035 560Q1061 565 1053 611L1046 650L1024 671Q1024 702 1040 718L1047 738L1035 756L1026 744L1015 722L1003 687L994 677Q960 750 891 787Q826 819 754 820Q670 820 601 789Q529 750 502 687L482 681L480 710L466 745L470 773Q446 759 450 737L463 699L466 677Q440 657 440 608Q436 571 450 554Z'}
  ]}
};

export interface MasterPose{head:number;leftArm:number;rightArm:number;leftLeg:number;rightLeg:number;lean:number;bob:number;reach:number}
// Pose is a deterministic function of the controller frame. Reload resumes it
// exactly; CSS animation clocks cannot restart independently of gameplay.
export function doctorMasterPose(animation:ActorAnimation,frame:number):MasterPose{
  const wave=Math.sin((frame%8)/8*Math.PI*2);
  const pose:MasterPose={head:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0,lean:0,bob:0,reach:0};
  if(animation.startsWith('walk')||animation==='stand'){
    pose.leftLeg=wave*5;pose.rightLeg=-wave*5;pose.leftArm=-wave*3;pose.rightArm=wave*3;pose.bob=-Math.abs(wave)*9;
  }else switch(animation){
    case 'idle':pose.bob=wave*1.5;break;
    case 'look_left':pose.head=-4;break;
    case 'look_right':pose.head=4;break;
    case 'greet':pose.rightArm=-12+wave*10;pose.head=wave*2;break;
    case 'sit':pose.bob=24;pose.leftLeg=-7;pose.rightLeg=7;break;
    case 'observe_patient':case 'check_bed':pose.head=4+wave*2;pose.lean=2;break;
    case 'pulse_check':pose.rightArm=18;pose.leftArm=-12;pose.lean=4;pose.reach=14;break;
    case 'write_record':pose.rightArm=12+wave*3;pose.leftArm=-4;pose.head=5;break;
    case 'think':pose.head=-5;pose.rightArm=-8;break;
    case 'open_drawer':pose.rightArm=-10+wave*8;pose.reach=8+wave*7;break;
    case 'take_herb':pose.rightArm=-14;pose.leftArm=-3;pose.reach=12;break;
    case 'weigh_herb':pose.rightArm=12+wave*4;pose.leftArm=-5;break;
    case 'grind_herb':case 'mix_herb':pose.rightArm=14+wave*7;pose.leftArm=-6;pose.reach=wave*5;break;
    case 'cook_medicine':pose.rightArm=12+wave*8;pose.lean=2;pose.reach=wave*6;break;
    case 'package_medicine':pose.leftArm=-9+wave*2;pose.rightArm=13-wave*4;pose.head=4;break;
    case 'talk_patient':pose.head=wave*2;pose.rightArm=wave*5;break;
  }
  return pose;
}

export function renderDoctorMaster(node:HTMLElement,animation:ActorAnimation,frame:number){
  const root=node.querySelector<SVGSVGElement>('[data-master-gender]');if(!root)return;
  const gender=root.dataset.masterGender as DoctorGender;
  const master=DOCTOR_MASTERS[gender];if(!master)return;
  const pose=doctorMasterPose(animation,frame);
  for(const layer of master.layers){
    const group=root.querySelector<SVGGElement>(`[data-master-part="${layer.part}"]`);
    const angle=layer.part==='torso'||layer.part==='hairBack'?0:pose[layer.part];
    const dx=layer.part==='rightArm'?pose.reach:0;
    group?.setAttribute('transform',`translate(${dx} 0) rotate(${angle} ${layer.pivot[0]} ${layer.pivot[1]})`);
  }
  root.querySelector('[data-master-body]')?.setAttribute('transform',`translate(0 ${pose.bob}) rotate(${pose.lean} 760 1300)`);
}
