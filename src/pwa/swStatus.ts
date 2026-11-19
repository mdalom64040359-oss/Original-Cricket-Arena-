import {useEffect, useState} from 'react';

export interface ServiceWorkerState {
  supported: boolean;
  registered: boolean;
  offlineReady: boolean;
  needRefresh: boolean;
  error: string | null;
}

type Listener = (state: ServiceWorkerState) => void;

let currentState: ServiceWorkerState = {
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  registered: false,
  offlineReady:
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker.controller),
  needRefresh: false,
  error: null,
};

let applyUpdateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(currentState));
}

export function setServiceWorkerUpdateFn(fn: (reloadPage?: boolean) => Promise<void>) {
  applyUpdateFn = fn;
}

export function updateServiceWorkerState(patch: Partial<ServiceWorkerState>) {
  currentState = {...currentState, ...patch};
  emit();
}

export function getServiceWorkerState(): ServiceWorkerState {
  return currentState;
}

export async function triggerServiceWorkerRefresh(): Promise<void> {
  if (applyUpdateFn) {
    await applyUpdateFn(true);
  }
}

export function useServiceWorkerStatus(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>(currentState);

  useEffect(() => {
    listeners.add(setState);

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          updateServiceWorkerState({
            registered: true,
            offlineReady: Boolean(registration.active || navigator.serviceWorker.controller),
          });
        })
        .catch(() => {
          // Handled by registerSW error callback if registration fails
        });
    }

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
