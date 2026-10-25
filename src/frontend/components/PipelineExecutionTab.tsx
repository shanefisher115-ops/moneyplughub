import React, { useState } from "react";

export function PipelineExecutionTab() {
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
      if (!data.success) throw new Error(data.error || "Execution failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", color: "#e2e8f0", fontFamily: "monospace" }}>
      <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", padding: "2rem", backdropFilter: "blur(12px)" }}>
        <h2 style={{ color: "#38bdf8", marginTop: 0 }}>PrimordiaOS // Autonomous Pipeline</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Oracle $\rightarrow$ Architect $\rightarrow$ Planner $\rightarrow$ Builder Real-Time Engine</p>

        <form onSubmit={handleExecute} style={{ display: "grid", gap: "1rem", maxWidth: "700px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#cbd5e1" }}>System Intent / Objective</label>
            <input 
              type="text" 
              value={intent} 
              onChange={(e) => setIntent(e.target.value)} 
              placeholder="e.g., Automate B2B lead scraping pipeline"
              style={{ width: "100%", padding: "0.75rem", background: "#0b0f19", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#cbd5e1" }}>Target Module / Domain</label>
            <input 
              type="text" 
              value={targetDomain} 
              onChange={(e) => setTargetDomain(e.target.value)} 
              placeholder="e.g., LeadScraperEngine"
              style={{ width: "100%", padding: "0.75rem", background: "#0b0f19", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ background: "linear-gradient(135deg, #0284c7, #2563eb)", color: "#fff", border: "none", padding: "0.75rem 1.5rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)" }}
          >
            {loading ? "Executing Autonomous Pipeline..." : "Dispatch Autonomous Build"}
          </button>
        </form>

        {error && <div style={{ marginTop: "1.5rem", background: "rgba(127, 29, 29, 0.4)", border: "1px solid #ef4444", padding: "1rem", borderRadius: "6px", color: "#fca5a5" }}>{error}</div>}

        {result && (
          <div style={{ marginTop: "2rem", display: "grid", gap: "1rem" }}>
            <div style={{ background: "#0b0f19", border: "1px solid #334155", padding: "1.25rem", borderRadius: "8px" }}>
              <h4 style={{ color: "#38bdf8", margin: "0 0 0.5rem 0" }}>Architect Spec: {result.spec.specId}</h4>
              <p style={{ margin: 0, color: "#94a3b8" }}>{result.spec.designIntent}</p>
            </div>
            <div style={{ background: "#0b0f19", border: "1px solid #334155", padding: "1.25rem", borderRadius: "8px" }}>
              <h4 style={{ color: "#4ade80", margin: "0 0 0.5rem 0" }}>Scaffolded Files ({result.result.generatedFiles.length})</h4>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#cbd5e1" }}>
                {result.result.generatedFiles.map((file: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: "0.25rem" }}>{file}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
