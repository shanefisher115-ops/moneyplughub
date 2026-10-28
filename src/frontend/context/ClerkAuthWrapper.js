import React, { createContext, useContext, useState } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
const CLERK_PUBLISHABLE_KEY = import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY || '';
const ClerkAuthContext = createContext(undefined);
export const ClerkAuthWrapper = ({ children }) => {
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSubscriptionGateOpen, setIsSubscriptionGateOpen] = useState(false);
    const [gateRequiredTier, setGateRequiredTier] = useState('Creator');
    const triggerSubscriptionGate = (tier) => {
        setGateRequiredTier(tier);
        setIsSubscriptionGateOpen(true);
    };
    const contextValue = {
        hasClerkKey: !!CLERK_PUBLISHABLE_KEY,
        isApiKeyModalOpen,
        openApiKeyModal: () => setIsApiKeyModalOpen(true),
        closeApiKeyModal: () => setIsApiKeyModalOpen(false),
        isProfileModalOpen,
        openProfileModal: () => setIsProfileModalOpen(true),
        closeProfileModal: () => setIsProfileModalOpen(false),
        isSubscriptionGateOpen,
        gateRequiredTier,
        triggerSubscriptionGate,
        closeSubscriptionGate: () => setIsSubscriptionGateOpen(false),
    };
    const innerContent = (<ClerkAuthContext.Provider value={contextValue}>
      {children}
    </ClerkAuthContext.Provider>);
    // If a valid live Clerk key is provided, wrap in real ClerkProvider
    if (CLERK_PUBLISHABLE_KEY && CLERK_PUBLISHABLE_KEY.startsWith('pk_')) {
        return (<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        {innerContent}
      </ClerkProvider>);
    }
    // Fallback: seamless zero-friction local auth mode
    return innerContent;
};
export const useClerkAuth = () => {
    const context = useContext(ClerkAuthContext);
    if (!context) {
        throw new Error('useClerkAuth must be used within a ClerkAuthWrapper');
    }
    return context;
};
