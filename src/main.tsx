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
import './viewport-news-final.css';
import './viewport-native-hotfix.css';
import './news-rotator.css';
import './desktop-community.css';
import './final4-v2.css';
import './desktop-interaction-profile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>
);

if('serviceWorker' in navigator&&import.meta.env.PROD){
  window.addEventListener('load',()=>{
    const base=import.meta.env.BASE_URL||'/';
    void navigator.serviceWorker.register(`${base}service-worker.js`).catch(()=>{});
  });
}
