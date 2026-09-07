import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/system/AppErrorBoundary';
import './styles.css';
import './modules.css';
import './mobile-audit.css';
import './audit-release.css';
import './final-hotfix.css';
import './mobile-social.css';
import './mobile-social-compat.css';
import './mini-ai.css';

// One-time preference migration for the finalized 5-module social mobile UI.
// Existing devices may still carry the old `classic` fallback choice from the
// previous review cycle. Reset it once, while preserving the in-app rollback
// control for any classic choice made after this release.
try{
  const migrationKey='yhct-mobile-social-final-v2';
  if(localStorage.getItem(migrationKey)!=='1'){
    localStorage.removeItem('yhct-mobile-ui-v1');
    localStorage.setItem(migrationKey,'1');
  }
}catch{}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App/></AppErrorBoundary>
  </React.StrictMode>
);

if('serviceWorker' in navigator&&import.meta.env.PROD){
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/service-worker.js').catch(()=>{})});
}
