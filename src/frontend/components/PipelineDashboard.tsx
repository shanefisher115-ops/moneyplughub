import React, { useState } from "react";

export function PipelineDashboard() {
  const [intent, setIntent] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("http://localhost:3001/api/pipeline/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, targetDomain })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Pipeline execution failed");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", background: "#0b0f19", color: "#e2e8f0", minHeight: "100vh", fontFamily: "monospace" }}>
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid #1e293b", paddingBottom: "1rem" }}>
        <h1 style={{ color: "#38bdf8", margin: 0 }}>PrimordiaOS // Autonomous Pipeline</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Oracle $\rightarrow$ Architect $\rightarrow$ Planner $\rightarrow$ Builder</p>
      </header>

      <form onSubmit={handleExecute} style={{ background: "#1e293b", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem", maxWidth: "800px" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#cbd5e1" }}>System Intent / Objective:</label>
          <input 
            type="text" 
            value={intent} 
            onChange={(e) => setIntent(e.target.value)} 
            placeholder="e.g., Automate real-time crypto webhook tracking"
            style={{ width: "100%", padding: "0.75rem", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "4px" }}
            required
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "$cbd5e1" }}>Target Domain Name:</label>
          <input 
            type="text" 
            value={targetDomain} 
            onChange={(e) => setTargetDomain(e.target.value)} 
            placeholder="e.g., CryptoTracker"
            style={{ width: "100%", padding: "0.75rem", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "4px" }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ background: "#0284c7", color: "#fff", border: "none", padding: "0.75rem 1.5rem", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          {loading ? "Executing Pipeline..." : "Dispatch Autonomous Build"}
        </button>
      </form>

      {error && (
        <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", padding: "1rem", borderRadius: "6px", maxWidth: "800px", marginBottom: "2rem" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ maxWidth: "800px" }}>
          <div style={{ background: "#0f172a", border: "1px solid #334155", padding: "1.5rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#38bdf8", marginTop: 0 }}>Architect Spec ID: {result.spec.specId}</h3>
            <p><strong>Design Intent:</strong> {result.spec.designIntent}</p>
            <p><strong>Strategy:</strong> {result.spec.executionStrategy}</p>
          </div>

          <div style={{ background: "#0f172a", border: "1px solid #334155", padding: "1.5rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#a855f7", marginTop: 0 }}>Generated Files ({result.result.generatedFiles.length})</h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#4ade80" }}>
              {result.result.generatedFiles.map((file: string, idx: number) => (
                <li key={idx} style={{ marginBottom: "0.5rem" }}>{file}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
