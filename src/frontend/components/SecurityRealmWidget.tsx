import React from "react";

export const SecurityRealmWidget: React.FC = () => {
    return (
        <div className="bg-plug-card border border-plug-border p-6 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-plug-accent">SecurityRealmWidget Realm</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ONLINE</span>
            </div>
            <p className="text-xs text-slate-400">Autonomous realm telemetry & monitoring node active.</p>
        </div>
    );
};
