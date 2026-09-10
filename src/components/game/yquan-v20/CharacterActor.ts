import {AnimationController} from './AnimationController';
import {PathSystem} from './PathSystem';
import {SCENES,sceneWaypoint} from './sceneGraph';
import type {ActorAnimation,ActorDirection,ActorSnapshot,SceneId,WorldPoint} from './types';

type ArriveListener=(scene:SceneId,waypoint:string)=>void;
type AnimationListener=(animation:ActorAnimation)=>void;

const WALK_ANIMATION:Record<ActorDirection,ActorAnimation>={front:'walk_front',back:'walk_back',left:'walk_left',right:'walk_right'};

export class CharacterActor<S extends string>{
  readonly id:'doctor'|'patient';
  scene:SceneId;
  position:WorldPoint;
  waypoint:string;
  direction:ActorDirection='front';
  state:S;
  visible=true;
  speed:number;
  readonly animation:AnimationController;
  private path:{id:string;x:number;y:number}[]=[];
  private targetWaypoint:string|null=null;
  private arriveListener?:ArriveListener;

  constructor(options:{id:'doctor'|'patient';scene:SceneId;waypoint:string;state:S;speed:number;onArrive?:ArriveListener;onAnimationComplete?:AnimationListener}){
    this.id=options.id;this.scene=options.scene;this.waypoint=options.waypoint;this.state=options.state;this.speed=options.speed;this.arriveListener=options.onArrive;
    const start=sceneWaypoint(options.scene,options.waypoint);this.position={x:start.x,y:start.y};
    this.animation=new AnimationController(options.onAnimationComplete);
  }

  setState(state:S){this.state=state}

  setScene(scene:SceneId,waypoint=SCENES[scene].spawn){
    this.scene=scene;this.waypoint=waypoint;this.targetWaypoint=null;this.path=[];
    const point=sceneWaypoint(scene,waypoint);this.position={x:point.x,y:point.y};
  }

  restore(snapshot:ActorSnapshot<S>){
    if(!SCENES[snapshot.scene]?.waypoints[snapshot.waypoint])return false;
    this.scene=snapshot.scene;this.position={...snapshot.position};this.waypoint=snapshot.waypoint;this.direction=snapshot.direction;this.state=snapshot.state;this.visible=snapshot.visible;
    this.path=[];this.targetWaypoint=null;this.animation.play(snapshot.animation,true);return true;
  }

  requestMove(targetWaypoint:string){
    const nearest=PathSystem.nearestWaypoint(this.scene,this.position);
    const route=PathSystem.calculate(this.scene,nearest.id,targetWaypoint);
    this.waypoint=nearest.id;this.path=route.map(point=>({id:point.id,x:point.x,y:point.y}));this.targetWaypoint=targetWaypoint;
    if(!this.path.length){this.waypoint=targetWaypoint;this.targetWaypoint=null;this.arriveListener?.(this.scene,targetWaypoint);return}
    this.direction=PathSystem.direction(this.position,this.path[0]);this.animation.play(WALK_ANIMATION[this.direction]);
  }

  cancelMove(){this.path=[];this.targetWaypoint=null;this.animation.play('idle')}
  isMoving(){return this.path.length>0}
  target(){return this.targetWaypoint}

  play(animation:ActorAnimation,restart=false){this.animation.play(animation,restart)}

  update(deltaMs:number){
    this.animation.update(deltaMs);
    if(!this.path.length)return;
    let remaining=Math.max(0,Math.min(deltaMs,100))*this.speed/1000;
    while(remaining>0&&this.path.length){
      const target=this.path[0],dx=target.x-this.position.x,dy=target.y-this.position.y,distance=Math.hypot(dx,dy);
      if(distance<=Math.max(0.01,remaining)){
        this.position={x:target.x,y:target.y};remaining-=distance;this.waypoint=target.id;this.path.shift();
        if(this.path.length){this.direction=PathSystem.direction(this.position,this.path[0]);this.animation.play(WALK_ANIMATION[this.direction]);continue}
        const arrived=this.targetWaypoint||target.id;this.targetWaypoint=null;this.animation.play('idle');this.arriveListener?.(this.scene,arrived);break;
      }
      this.direction=PathSystem.direction(this.position,target);this.animation.play(WALK_ANIMATION[this.direction]);
      const ratio=remaining/distance;this.position={x:this.position.x+dx*ratio,y:this.position.y+dy*ratio};remaining=0;
    }
  }

  snapshot():ActorSnapshot<S>{
    return {scene:this.scene,position:{...this.position},waypoint:this.waypoint,direction:this.direction,state:this.state,animation:this.animation.current,visible:this.visible};
  }
}
