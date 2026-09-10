import {SCENES} from './sceneGraph';
import type {SceneId,WorldPoint} from './types';

const distance=(a:WorldPoint,b:WorldPoint)=>Math.hypot(a.x-b.x,a.y-b.y);

export class PathSystem{
  static nearestWaypoint(scene:SceneId,position:WorldPoint){
    const points=Object.values(SCENES[scene].waypoints);
    return points.reduce((best,next)=>distance(next,position)<distance(best,position)?next:best,points[0]);
  }

  static calculate(scene:SceneId,from:string,to:string){
    const graph=SCENES[scene].waypoints;
    if(!graph[from]||!graph[to])throw new Error(`Unknown waypoint route ${scene}:${from}->${to}`);
    if(from===to)return [graph[to]];
    const queue=[from],visited=new Set([from]),parent=new Map<string,string>();
    while(queue.length){
      const id=queue.shift()!;
      if(id===to)break;
      for(const next of graph[id].links){
        if(!graph[next]||visited.has(next))continue;
        visited.add(next);parent.set(next,id);queue.push(next);
      }
    }
    if(!visited.has(to))throw new Error(`No path ${scene}:${from}->${to}`);
    const ids=[to];
    while(ids[0]!==from){
      const previous=parent.get(ids[0]);
      if(!previous)throw new Error(`Broken path ${scene}:${from}->${to}`);
      ids.unshift(previous);
    }
    return ids.slice(1).map(id=>graph[id]);
  }

  static direction(from:WorldPoint,to:WorldPoint){
    const dx=to.x-from.x,dy=to.y-from.y;
    if(Math.abs(dx)>Math.abs(dy))return dx<0?'left' as const:'right' as const;
    return dy<0?'back' as const:'front' as const;
  }
}
