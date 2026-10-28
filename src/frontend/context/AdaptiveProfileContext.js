import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
const DEFAULT_PROFILE = {
    userId: 'demo_guest_user',
    archetype: 'sovereign_operator',
    archetypeTitle: 'Sovereign Operator',
    archetypeTagline: 'Balanced multi-hyphenate orchestrating all financial chambers.',
    archetypeEmblem: 'Crown',
    paletteTheme: 'emerald',
    voicePreset: 'general_conversation',
    voiceSpeed: 1.0,
    voiceGreeting: 'Welcome back, Sovereign Operator.',
    uiPriorityTabs: ['overview', 'referral-hub', 'sigil-forge', 'net-worth', 'moneyos'],
    actionCount: 0,
    isCalibrated: false,
    affinityScores: { growth: 20, vault: 20, alchemist: 20, quant: 20, sovereign: 20 },
};
const AdaptiveProfileContext = createContext(undefined);
export const AdaptiveProfileProvider = ({ children }) => {
    const { token } = useAuth();
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
    const fetchProfile = useCallback(async () => {
        try {
            const headers = {};
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/profile/adaptive', { headers });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data) {
                    setProfile(j.data);
                }
            }
        }
        catch (e) {
            console.warn('Failed to load adaptive profile:', e);
        }
    }, [token]);
    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);
    const trackAction = useCallback(async (actionName, category) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/profile/track-action', {
                method: 'POST',
                headers,
                body: JSON.stringify({ actionName, category }),
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data) {
                    setProfile(prev => ({ ...prev, ...j.data }));
                }
            }
        }
        catch (e) {
            console.warn('Failed to track action:', e);
        }
    }, [token]);
    const submitCalibration = useCallback(async (answers) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/profile/calibrate-questions', {
                method: 'POST',
                headers,
                body: JSON.stringify(answers),
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data) {
                    setProfile(prev => ({ ...prev, ...j.data, isCalibrated: true }));
                }
            }
        }
        catch (e) {
            console.warn('Failed to submit calibration:', e);
        }
    }, [token]);
    return (<AdaptiveProfileContext.Provider value={{
            profile,
            archetype: profile.archetype,
            isCalibrationModalOpen,
            setIsCalibrationModalOpen,
            trackAction,
            submitCalibration,
            refreshProfile: fetchProfile,
        }}>
      {children}
    </AdaptiveProfileContext.Provider>);
};
export const useAdaptiveProfile = () => {
    const context = useContext(AdaptiveProfileContext);
    if (!context) {
        throw new Error('useAdaptiveProfile must be used within an AdaptiveProfileProvider');
    }
    return context;
};
