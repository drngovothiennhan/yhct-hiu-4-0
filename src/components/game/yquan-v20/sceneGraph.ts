import type {InteractionPoint,SceneDefinition,SceneId,Waypoint} from './types';

const wp=(id:string,x:number,y:number,links:string[]):Waypoint=>({id,x,y,links});
const ip=(id:string,x:number,y:number,kind:InteractionPoint['kind']):InteractionPoint=>({id,x,y,kind});

export const CLINIC_SCENE:SceneDefinition={
  id:'clinic',width:1600,height:900,spawn:'C_ENTRANCE',exit:'C_HALL',
  waypoints:{
    C_ENTRANCE:wp('C_ENTRANCE',1450,705,['C_WAIT','C_HALL']),
    C_WAIT:wp('C_WAIT',1260,690,['C_ENTRANCE','C_CENTER']),
    C_CENTER:wp('C_CENTER',920,650,['C_WAIT','C_DESK_PATIENT','C_DESK_DOCTOR','C_CABINET','C_HALL']),
    C_DESK_PATIENT:wp('C_DESK_PATIENT',850,590,['C_CENTER']),
    C_DESK_DOCTOR:wp('C_DESK_DOCTOR',690,560,['C_CENTER','C_RECORD']),
    C_RECORD:wp('C_RECORD',575,555,['C_DESK_DOCTOR','C_CABINET']),
    C_CABINET:wp('C_CABINET',315,560,['C_RECORD','C_CENTER','C_IDLE']),
    C_IDLE:wp('C_IDLE',470,705,['C_CABINET','C_HALL']),
    C_PHARMACY_EXIT:wp('C_PHARMACY_EXIT',95,685,['C_HALL']),
    C_WARD_EXIT:wp('C_WARD_EXIT',1510,500,['C_HALL']),
    C_HALL:wp('C_HALL',1000,735,['C_ENTRANCE','C_CENTER','C_IDLE','C_PHARMACY_EXIT','C_WARD_EXIT'])
  },
  interactions:{
    clinicEntrance:ip('clinicEntrance',1450,705,'entrance'),
    patientWaitingPoint:ip('patientWaitingPoint',1260,690,'waiting'),
    doctorIdlePoint:ip('doctorIdlePoint',470,705,'idle'),
    pulseDeskDoctorPoint:ip('pulseDeskDoctorPoint',690,560,'desk'),
    pulseDeskPatientPoint:ip('pulseDeskPatientPoint',850,590,'desk'),
    recordWritingPoint:ip('recordWritingPoint',575,555,'desk'),
    medicineCabinetPoint:ip('medicineCabinetPoint',315,560,'cabinet'),
    exitToPharmacy:ip('exitToPharmacy',95,685,'exit'),
    exitToWard:ip('exitToWard',1510,500,'exit')
  }
};

export const PHARMACY_SCENE:SceneDefinition={
  id:'pharmacy',width:1600,height:900,spawn:'P_ENTRANCE',exit:'P_EXIT',
  waypoints:{
    P_ENTRANCE:wp('P_ENTRANCE',1450,700,['P_CENTER','P_EXIT']),
    P_CENTER:wp('P_CENTER',980,700,['P_ENTRANCE','P_CABINET','P_SCALE','P_MORTAR','P_POT','P_PACKAGE']),
    P_CABINET:wp('P_CABINET',330,545,['P_CENTER','P_TRAY']),
    P_TRAY:wp('P_TRAY',555,585,['P_CABINET','P_SCALE']),
    P_SCALE:wp('P_SCALE',730,585,['P_TRAY','P_CENTER','P_MORTAR']),
    P_MORTAR:wp('P_MORTAR',900,585,['P_SCALE','P_CENTER','P_POT']),
    P_POT:wp('P_POT',1110,575,['P_MORTAR','P_CENTER','P_PACKAGE']),
    P_PACKAGE:wp('P_PACKAGE',1280,590,['P_POT','P_CENTER','P_EXIT']),
    P_EXIT:wp('P_EXIT',1510,705,['P_PACKAGE','P_ENTRANCE'])
  },
  interactions:{
    pharmacyEntrance:ip('pharmacyEntrance',1450,700,'entrance'),
    herbCabinet:ip('herbCabinet',330,545,'cabinet'),
    ingredientTray:ip('ingredientTray',555,585,'tool'),
    medicineScale:ip('medicineScale',730,585,'tool'),
    mortar:ip('mortar',900,585,'tool'),
    preparationDesk:ip('preparationDesk',810,620,'desk'),
    medicinePot:ip('medicinePot',1110,575,'tool'),
    packageDesk:ip('packageDesk',1280,590,'desk'),
    exit:ip('exit',1510,705,'exit')
  }
};

export const WARD_SCENE:SceneDefinition={
  id:'ward',width:1600,height:900,spawn:'W_ENTRANCE',exit:'W_EXIT',
  waypoints:{
    W_ENTRANCE:wp('W_ENTRANCE',120,705,['W_CENTER','W_EXIT']),
    W_CENTER:wp('W_CENTER',700,710,['W_ENTRANCE','W_BED1','W_BED2','W_BED3','W_BED1_DOCTOR','W_BED2_DOCTOR','W_BED3_DOCTOR','W_DESK']),
    W_BED1:wp('W_BED1',430,555,['W_CENTER','W_DESK','W_BED1_DOCTOR']),
    W_BED2:wp('W_BED2',820,555,['W_CENTER','W_DESK','W_BED2_DOCTOR']),
    W_BED3:wp('W_BED3',1210,555,['W_CENTER','W_DESK','W_BED3_DOCTOR']),
    W_BED1_DOCTOR:wp('W_BED1_DOCTOR',680,700,['W_CENTER','W_BED1','W_DESK']),
    W_BED2_DOCTOR:wp('W_BED2_DOCTOR',1070,700,['W_CENTER','W_BED2','W_DESK']),
    W_BED3_DOCTOR:wp('W_BED3_DOCTOR',1450,700,['W_CENTER','W_BED3','W_DESK']),
    W_DESK:wp('W_DESK',1390,710,['W_CENTER','W_BED1','W_BED2','W_BED3','W_BED1_DOCTOR','W_BED2_DOCTOR','W_BED3_DOCTOR']),
    W_EXIT:wp('W_EXIT',75,705,['W_ENTRANCE'])
  },
  interactions:{
    wardEntrance:ip('wardEntrance',120,705,'entrance'),
    BED_01:ip('BED_01',430,555,'bed'),
    BED_02:ip('BED_02',820,555,'bed'),
    BED_03:ip('BED_03',1210,555,'bed'),
    wardDesk:ip('wardDesk',1390,710,'desk'),
    exit:ip('exit',75,705,'exit')
  }
};

export const SCENES:Record<SceneId,SceneDefinition>={clinic:CLINIC_SCENE,pharmacy:PHARMACY_SCENE,ward:WARD_SCENE};

export const SCENE_LABEL:Record<SceneId,string>={clinic:'Phòng Chẩn Mạch',pharmacy:'Phòng Chế Dược',ward:'Phòng Dưỡng Trị'};

export const BED_WAYPOINTS:Record<1|2|3,string>={1:'W_BED1',2:'W_BED2',3:'W_BED3'};
export const BED_DOCTOR_WAYPOINTS:Record<1|2|3,string>={1:'W_BED1_DOCTOR',2:'W_BED2_DOCTOR',3:'W_BED3_DOCTOR'};
export const BED_INTERACTIONS:Record<number,string>={1:'BED_01',2:'BED_02',3:'BED_03'};

export const sceneWaypoint=(scene:SceneId,id:string)=>SCENES[scene].waypoints[id]??SCENES[scene].waypoints[SCENES[scene].spawn];
