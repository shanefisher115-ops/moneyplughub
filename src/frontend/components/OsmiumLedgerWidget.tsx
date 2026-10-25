import React, { useState } from 'react';

export interface OsmiumLedgerWidgetProps {
  onAction?: () => void;
}

export const OsmiumLedgerWidget: React.FC<OsmiumLedgerWidgetProps> = ({ onAction }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-cyan-500/30">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-cyan-400">OsmiumLedgerWidget Interface</h2>
        <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
          SYSTEM ACTIVE
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Autonomous control interface for managing and monitoring OsmiumLedgerWidget operations.
      </p>
      <div className="flex gap-3">
        <button 
          onClick={() => {
            setLoading(!loading);
            if (onAction) onAction();
          }} 
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition"
        >
          {loading ? "Processing..." : "Trigger Action"}
        </button>
      </div>
    </div>
  );
};

export default OsmiumLedgerWidget;
