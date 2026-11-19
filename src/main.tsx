import {Capacitor} from '@capacitor/core';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import {
  setServiceWorkerUpdateFn,
  updateServiceWorkerState,
} from './pwa/swStatus';

if (Capacitor.isNativePlatform()) {
  updateServiceWorkerState({
    supported: true,
    registered: true,
    offlineReady: true,
    needRefresh: false,
    error: null,
  });
} else {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateServiceWorkerState({needRefresh: true, registered: true});
    },
    onOfflineReady() {
      updateServiceWorkerState({offlineReady: true, registered: true, error: null});
    },
    onRegisteredSW(_swUrl, registration) {
      updateServiceWorkerState({
        registered: true,
        offlineReady: Boolean(registration?.active || navigator.serviceWorker?.controller),
        error: null,
      });
    },
    onRegisterError(err) {
      updateServiceWorkerState({
        error: err instanceof Error ? err.message : 'Service worker registration unavailable',
      });
    },
  });

  setServiceWorkerUpdateFn(updateSW);
}

createRoot(document.getElementById('root')!).render(<App />);
