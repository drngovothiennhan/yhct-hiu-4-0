import {supabase} from '../../../services/authService';
import type {DoctorGender,DoctorOutfit,HerbVisual,PlayerVisualState,VisualCase} from './types';

const missingFunction=(message?:string)=>/function|schema cache|does not exist/i.test(message||'');

export class LegacyRuleAdapter{
  async getPlayerState(){
    const {data,error}=await supabase.rpc('hiu_y_quan_state_v1');
    if(error)throw error;
    return (data||{active:false}) as PlayerVisualState;
  }

  async getCases(){
    let response=await supabase.rpc('hiu_y_quan_hourly_cases_v20');
    if(response.error&&missingFunction(response.error.message))response=await supabase.rpc('hiu_y_quan_hourly_cases_v4');
    if(response.error&&missingFunction(response.error.message))response=await supabase.rpc('hiu_y_quan_hourly_cases_v3');
    if(response.error&&missingFunction(response.error.message))response=await supabase.rpc('hiu_y_quan_hourly_cases_v2');
    if(response.error&&missingFunction(response.error.message))response=await supabase.rpc('hiu_y_quan_hourly_cases_v1');
    if(response.error)throw response.error;
    return (Array.isArray(response.data)?response.data:[]) as VisualCase[];
  }

  async getHerbs(){
    const {data,error}=await supabase.rpc('hiu_y_quan_herbs_v14');
    if(error)throw error;
    return (Array.isArray(data)?data:[]) as HerbVisual[];
  }

  async getRecords(query:string,limit=50){
    const {data,error}=await supabase.rpc('hiu_y_quan_records_v14',{p_query:query.trim(),p_limit:limit});
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  async activate(displayName:string,gender:DoctorGender){
    const {data,error}=await supabase.rpc('hiu_y_quan_activate_v1',{p_display_name:displayName,p_gender:gender});
    if(error)throw error;return data;
  }

  async customize(gender:DoctorGender,outfit:DoctorOutfit){
    const {data,error}=await supabase.rpc('hiu_y_quan_customize_v1',{p_gender:gender,p_outfit:outfit});
    if(error)throw error;return data;
  }

  async submitDiagnosis(caseKey:string,selectedCode:string){
    const {data,error}=await supabase.rpc('hiu_y_quan_submit_v1',{p_case_key:caseKey,p_selected_code:selectedCode});
    if(error)throw error;return data;
  }

  async disposition(caseKey:string,action:'observe'|'discharge'){
    let response=await supabase.rpc('hiu_y_quan_disposition_v20',{p_case_key:caseKey,p_action:action});
    if(response.error&&missingFunction(response.error.message))response=await supabase.rpc('hiu_y_quan_disposition_v17',{p_case_key:caseKey,p_action:action});
    if(!response.error)return response.data;
    if(action!=='observe'||!missingFunction(response.error.message))throw response.error;
    const fallback=await supabase.rpc('hiu_y_quan_start_treatment_v14',{p_case_key:caseKey});
    if(fallback.error)throw fallback.error;return fallback.data;
  }

  async recheck(caseKey:string){
    const {data,error}=await supabase.rpc('hiu_y_quan_recheck_v14',{p_case_key:caseKey});
    if(error)throw error;return data;
  }

  async decideAppointment(caseKey:string,accept:boolean){
    const {data,error}=await supabase.rpc('hiu_y_quan_appointment_decide_v2',{p_case_key:caseKey,p_accept:accept});
    if(error)throw error;return data;
  }
}

export const legacyRuleAdapter=new LegacyRuleAdapter();
