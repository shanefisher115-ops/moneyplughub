import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
const PeerPushContext = createContext(undefined);
export const PeerPushProvider = ({ children }) => {
    const { token } = useAuth();
    const [events, setEvents] = useState([]);
    const [activeNotification, setActiveNotification] = useState(null);
    const [agkMetrics, setAgkMetrics] = useState({
        userId: 'default',
        kFactor: 1.42,
        viralVelocity: 0.88,
        liftMultiplier: 1.65,
        activeLoopsCount: 5,
        cascadeStage: 'SUPERCRITICAL',
        swarmReactionState: 'SUPERCRITICAL_MOMENTUM',
        totalPeerSignals: 1420,
        recentSwarmAction: 'Antoni: High-velocity referral loop compounding at 1.45x.',
    });
    const [isStreamingActive, setIsStreamingActive] = useState(true);
    // 1. Fetch recent PeerPush events
    const fetchPushEvents = useCallback(async () => {
        try {
            const res = await fetch('/api/peersignal/push-events?limit=12');
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data?.events) {
                    setEvents(j.data.events);
                    if (j.data.events.length > 0 && Math.random() > 0.4) {
                        const randomEv = j.data.events[Math.floor(Math.random() * j.data.events.length)];
                        setActiveNotification(randomEv);
                    }
                }
            }
        }
        catch { }
    }, []);
    // 2. Fetch User AGK Metrics
    const fetchAGKMetrics = useCallback(async () => {
        if (!token)
            return;
        try {
            const res = await fetch('/api/agk/metrics', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data?.metrics) {
                    setAgkMetrics(j.data.metrics);
                }
            }
        }
        catch { }
    }, [token]);
    useEffect(() => {
        fetchPushEvents();
        fetchAGKMetrics();
        const interval = setInterval(() => {
            fetchPushEvents();
        }, 18000);
        return () => clearInterval(interval);
    }, [fetchPushEvents, fetchAGKMetrics]);
    // 3. Emit Universal PeerSignal
    const emitSignal = useCallback(async (signalType, targetResource = 'general', payload = {}, trustWeight = 1.0, influenceDelta = 0.5) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/peersignal/emit', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    signalType,
                    targetResource,
                    payload,
                    trustWeight,
                    influenceDelta,
                }),
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data) {
                    if (j.data.agk)
                        setAgkMetrics(j.data.agk);
                    if (j.data.pushEvent) {
                        setEvents(prev => [j.data.pushEvent, ...prev.slice(0, 11)]);
                        setActiveNotification(j.data.pushEvent);
                    }
                }
            }
        }
        catch { }
    }, [token]);
    // 4. Endorse Event
    const endorseEvent = useCallback(async (eventId) => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/peersignal/endorse', {
                method: 'POST',
                headers,
                body: JSON.stringify({ eventId }),
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success) {
                    setEvents(prev => prev.map(e => e.id === eventId ? {
                        ...e,
                        influenceCount: j.data.influenceCount,
                        trustScore: j.data.trustScore,
                    } : e));
                    if (activeNotification && activeNotification.id === eventId) {
                        setActiveNotification({
                            ...activeNotification,
                            influenceCount: j.data.influenceCount,
                            trustScore: j.data.trustScore,
                        });
                    }
                }
            }
        }
        catch { }
    }, [token, activeNotification]);
    // 5. Trigger Lift Cascade
    const triggerCascade = useCallback(async () => {
        if (!token)
            return;
        try {
            const res = await fetch('/api/agk/trigger-cascade', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const j = await res.json();
                if (j.success && j.data) {
                    if (j.data.agk)
                        setAgkMetrics(j.data.agk);
                    if (j.data.pushEvent) {
                        setEvents(prev => [j.data.pushEvent, ...prev.slice(0, 11)]);
                        setActiveNotification(j.data.pushEvent);
                    }
                }
            }
        }
        catch { }
    }, [token]);
    const dismissNotification = () => setActiveNotification(null);
    return (<PeerPushContext.Provider value={{
            events,
            activeNotification,
            agkMetrics,
            emitSignal,
            endorseEvent,
            triggerCascade,
            dismissNotification,
            isStreamingActive,
        }}>
      {children}
    </PeerPushContext.Provider>);
};
export const usePeerPush = () => {
    const context = useContext(PeerPushContext);
    if (!context) {
        throw new Error('usePeerPush must be used within a PeerPushProvider');
    }
    return context;
};
export const usePeerSignal = () => {
    const { emitSignal } = usePeerPush();
    return { emitSignal };
};
