import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/system/AppErrorBoundary';
import {bootstrapThemeState} from './theme';
import './design-system/tokens.css';
import './styles.css';
import './modules.css';
import './mobile-audit.css';
import './audit-release.css';
import './final-hotfix.css';
import './mobile-social.css';
import './mobile-social-compat.css';
import './mini-ai.css';
import './viewport-news-final.css';
import './news-rotator.css';
import './desktop-community.css';
import './final4-v2.css';
import './desktop-interaction-profile.css';
import './academic-production.css';
import './platform-upgrade.css';
import './chrome-qa-hotfix.css';
import './production-ui-sep8.css';
import './research-ai-upgrade.css';
import './exam-v2.css';
import './theme-runtime.css';
import './feed-academic-ai.css';
import './viewport-native-hotfix.css';
import './desktop-phone-full.css';
import './module-display-fixes.css';
import './xiaozhi-mini-v10.css';
import './feed-avatar-v10.css';
import './home-feed-phase4.css';
import './responsive-phase7.css';

bootstrapThemeState();

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);

const revealStableApp=()=>{
  const root=document.documentElement;
  root.dataset.appReady='1';
  delete root.dataset.appBooting;
  document.getElementById('yhct-prepaint')?.remove();
};
requestAnimationFrame(()=>requestAnimationFrame(revealStableApp));

if('serviceWorker' in navigator&&import.meta.env.PROD){
  window.addEventListener('load',()=>{
    const base=import.meta.env.BASE_URL||'/';
    const hadController=Boolean(navigator.serviceWorker.controller);
    const release=encodeURIComponent(String(__YHCT_RELEASE_ID__||'production'));
    const swUrl=`${base}service-worker.js?release=${release}`;
    let refreshing=false;
    let registration:ServiceWorkerRegistration|null=null;
    let updateTimer=0;

    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController||refreshing)return;
      refreshing=true;
      window.location.reload();
    });

    const checkForRelease=()=>{
      if(!registration||document.visibilityState==='hidden')return;
      void registration.update().catch(()=>{});
    };
    const onVisible=()=>{if(document.visibilityState==='visible')checkForRelease()};

    void navigator.serviceWorker.register(swUrl,{updateViaCache:'none'}).then(reg=>{
      registration=reg;
      void reg.update();
      updateTimer=window.setInterval(checkForRelease,15*60*1000);
      window.addEventListener('focus',checkForRelease,{passive:true});
      document.addEventListener('visibilitychange',onVisible);
    }).catch(()=>{});

    window.addEventListener('pagehide',()=>{
      if(updateTimer)window.clearInterval(updateTimer);
      window.removeEventListener('focus',checkForRelease);
      document.removeEventListener('visibilitychange',onVisible);
    },{once:true});
  });
}
