import type {ActorAnimation} from './types';

export interface AnimationClip{
  name:ActorAnimation;
  fps:number;
  frames:number;
  loop:boolean;
}

const clip=(name:ActorAnimation,fps:number,frames:number,loop=false):AnimationClip=>({name,fps,frames,loop});

export const ANIMATION_CLIPS:Record<ActorAnimation,AnimationClip>={
  idle:clip('idle',6,8,true),blink:clip('blink',8,3),look_left:clip('look_left',8,4),look_right:clip('look_right',8,4),
  walk_front:clip('walk_front',10,8,true),walk_back:clip('walk_back',10,8,true),walk_left:clip('walk_left',10,8,true),walk_right:clip('walk_right',10,8,true),
  greet:clip('greet',8,9),sit:clip('sit',8,6),stand:clip('stand',8,6),observe_patient:clip('observe_patient',8,12),pulse_check:clip('pulse_check',8,14),
  write_record:clip('write_record',10,16),think:clip('think',8,12),open_drawer:clip('open_drawer',8,10),take_herb:clip('take_herb',8,12),
  weigh_herb:clip('weigh_herb',10,18),grind_herb:clip('grind_herb',10,20),mix_herb:clip('mix_herb',10,16),cook_medicine:clip('cook_medicine',8,24),
  package_medicine:clip('package_medicine',10,18),check_bed:clip('check_bed',8,14),talk_patient:clip('talk_patient',8,12),
  walk:clip('walk',10,8,true),talk:clip('talk',8,10,false),pain:clip('pain',8,12,true),being_examined:clip('being_examined',8,12,false),
  lying:clip('lying',6,8,true),sleeping:clip('sleeping',6,12,true),recovering:clip('recovering',8,14,false),happy:clip('happy',8,12),leave:clip('leave',10,8,true)
};

export class AnimationController{
  current:ActorAnimation='idle';
  frame=0;
  playbackSpeed=1;
  private elapsed=0;
  private finished=false;
  private loopCycles=0;
  private onComplete?:(animation:ActorAnimation)=>void;

  constructor(onComplete?:(animation:ActorAnimation)=>void){this.onComplete=onComplete}

  play(name:ActorAnimation,restart=false){
    if(this.current===name&&!restart)return;
    this.current=name;this.frame=0;this.elapsed=0;this.finished=false;this.loopCycles=0;
  }

  update(deltaMs:number){
    const def=ANIMATION_CLIPS[this.current];
    if(this.finished&&!def.loop)return;
    this.elapsed+=Math.max(0,Math.min(deltaMs,100))*this.playbackSpeed;
    const frameMs=1000/def.fps;
    while(this.elapsed>=frameMs){
      this.elapsed-=frameMs;this.frame+=1;
      if(this.frame<def.frames)continue;
      if(def.loop){this.frame=0;this.loopCycles+=1;continue}
      this.frame=def.frames-1;this.finished=true;this.onComplete?.(this.current);break;
    }
  }

  isComplete(){return this.finished||(ANIMATION_CLIPS[this.current].loop&&this.loopCycles>0)}
  reset(){this.current='idle';this.frame=0;this.elapsed=0;this.finished=false;this.loopCycles=0}
}
