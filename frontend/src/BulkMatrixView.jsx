import React, { useState } from "react";
import api from "./api/client";

const BulkMatrixView = () => {
  const [jobIds, setJobIds] = useState("");
  const [candidateIds, setCandidateIds] = useState("");
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMatrix = async () => {
    setLoading(true);

    try {
      const res = await api.post("/bulk/matrix/", {
        job_ids: jobIds.split(",").map((x) => parseInt(x.trim())),
        candidate_ids: candidateIds.split(",").map((x) => parseInt(x.trim())),
      });
      setMatrix(res.data);
    } catch (e) {
      console.error("Matrix fetch error:", e);
      alert("Failed to load matrix data.");
    }

    setLoading(false);
  };

  const scoreColor = (score) => {
    if (score === null) return "#d1d5db";
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#eab308";
    return "#dc2626";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "15px" }}>JD × Candidate Matrix</h2>

      <div style={{ marginBottom: "20px" }}>
        <label>Job IDs (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. 1,2,3"
          value={jobIds}
          onChange={(e) => setJobIds(e.target.value)}
          style={{
            marginLeft: "10px",
            padding: "5px",
            borderRadius: "5px",
            border: "1px solid #cbd5e1",
          }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label>Candidate IDs (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. 10,11,12,15"
          value={candidateIds}
          onChange={(e) => setCandidateIds(e.target.value)}
          style={{
            marginLeft: "10px",
            padding: "5px",
            borderRadius: "5px",
            border: "1px solid #cbd5e1",
          }}
        />
      </div>

      <button
        onClick={fetchMatrix}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "8px 16px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Loading..." : "Generate Matrix"}
      </button>

      {matrix && (
        <div
          style={{
            marginTop: "20px",
            overflowX: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            
            {/* Table Header */}
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                <th style={{ padding: "12px", border: "1px solid #e2e8f0" }}>Candidate</th>
                {matrix.jobs.map((job) => (
                  <th
                    key={job.id}
                    style={{
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                      minWidth: "140px",
                      textAlign: "center",
                    }}
                  >
                    {job.title}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {matrix.candidates.map((cand) => (
                <tr key={cand.candidate_id}>
                  <td
                    style={{
                      padding: "10px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    {cand.candidate_name}
                  </td>

                  {cand.scores.map((cell, index) => (
                    <td
                      key={index}
                      style={{
                        padding: "10px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: scoreColor(cell.score),
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {cell.score === null ? "—" : cell.score}
                      <br />
                      <span style={{ fontSize: "12px", opacity: 0.85 }}>
                        {cell.status}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
};

export default BulkMatrixView;
