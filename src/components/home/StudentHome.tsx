import {lazy,Suspense} from 'react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';

const StudyHubV2=lazy(()=>import('./StudyHubV2'));

type Props={member:Member|null;onNavigate:(module:ModuleId)=>void;onLogin:()=>void};

/**
 * Phase 17E production convergence: Study OS V2 is the only Home runtime.
 * Rollback is performed through the verified Git/Vercel release history,
 * never through a user-addressable legacy query parameter.
 */
export default function StudentHome(props:Props){
  return <Suspense fallback={<section className="panel lazy-module-loading" role="status">Đang tải AI Study OS…</section>}><StudyHubV2 {...props}/></Suspense>;
}
