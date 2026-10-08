import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { GenerativeDesignProvider } from './context/GenerativeDesignContext';
import { LivingVaultProvider } from './context/LivingVaultContext';
import { LivingRealmProvider } from './context/LivingRealmContext';
import { AdaptiveProfileProvider } from './context/AdaptiveProfileContext';
import { GamificationXpProvider } from './context/GamificationXpContext';
import { PeerPushProvider } from './context/PeerPushContext';
import { ClerkAuthWrapper } from './context/ClerkAuthWrapper';
import { App } from './App';
import './index.css';
import * as Sentry from '@sentry/react';

// Error monitoring: only active when VITE_SENTRY_DSN is set (Vercel env var). No personal data is sent.
const sentryDsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, sendDefaultPii: false, tracesSampleRate: 0 });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ClerkAuthWrapper>
        <GenerativeDesignProvider>
          <LivingVaultProvider>
            <LivingRealmProvider>
              <AdaptiveProfileProvider>
                <GamificationXpProvider>
                  <PeerPushProvider>
                    <App />
                  </PeerPushProvider>
                </GamificationXpProvider>
              </AdaptiveProfileProvider>
            </LivingRealmProvider>
          </LivingVaultProvider>
        </GenerativeDesignProvider>
      </ClerkAuthWrapper>
    </AuthProvider>
  </React.StrictMode>
);
