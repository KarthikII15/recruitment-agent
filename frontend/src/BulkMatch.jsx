// frontend/src/BulkMatch.jsx
import React, { useEffect, useState } from "react";
import api from "./api/client";

const BulkMatch = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [poolFiles, setPoolFiles] = useState([]);
  const [driveResults, setDriveResults] = useState({}); // { [jobTitle]: [candidates] }
  const [loadingPool, setLoadingPool] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisByCandidateId, setAnalysisByCandidateId] = useState({}); // { [candidateId]: aiResult }
  const [error, setError] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null); // for detail view

  // --- Load Jobs on Mount ---
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await api.get("/jobs/");
        setJobs(res.data || []);
      } catch (e) {
        console.error("Error fetching jobs", e);
        setError("Failed to load jobs");
      }
    };
    fetchJobs();
  }, []);

  // --- Handlers ---
  const handleJobSelect = (jobId) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handlePoolFilesChange = (e) => {
    setPoolFiles(Array.from(e.target.files || []));
  };

  const handleUploadPool = async () => {
    if (!batchId.trim()) {
      setError("Please enter a Batch ID first");
      return;
    }
    if (!poolFiles.length) {
      setError("Please select resumes to upload");
      return;
    }

    setError("");
    setLoadingPool(true);
    try {
      for (const file of poolFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("batch_id", batchId);
        await api.post("/candidates/pool/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      alert("Pool upload completed!");
    } catch (e) {
      console.error("Pool upload error", e);
      setError("Failed to upload some pool resumes");
    } finally {
      setLoadingPool(false);
    }
  };

  const handleRunDrive = async () => {
    if (!batchId.trim()) {
      setError("Please enter a Batch ID first");
      return;
    }
    if (!selectedJobIds.length) {
      setError("Please select at least one Job");
      return;
    }

    setError("");
    setLoadingDrive(true);
    try {
      const res = await api.post("/drive/match/", {
        job_ids: selectedJobIds,
        batch_id: batchId,
      });
      setDriveResults(res.data || {});
      setAnalysisByCandidateId({});
      setSelectedAnalysis(null);
    } catch (e) {
      console.error("Drive run error", e);
      setError("Failed to run placement drive");
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleDeepAnalyze = async (jobId, candidateId) => {
    setAnalyzingId(candidateId);
    setError("");
    try {
      const res = await api.post("/screen/existing/", {
        job_id: jobId,
        candidate_id: candidateId,
      });

      const ai = res.data || {};
      setAnalysisByCandidateId((prev) => ({
        ...prev,
        [candidateId]: ai,
      }));
      setSelectedAnalysis(ai);
    } catch (e) {
      console.error("Deep analysis error", e);
      setError("Failed to analyze candidate");
    } finally {
      setAnalyzingId(null);
    }
  };

  const closeAnalysisPanel = () => {
    setSelectedAnalysis(null);
  };

  // --- UI Helpers ---
  const statusColor = (status) => {
    if (!status) return "#777";
    if (status.toLowerCase() === "shortlist") return "#0f766e"; // teal
    if (status.toLowerCase() === "reject") return "#b91c1c"; // red
    return "#4b5563"; // gray
  };

  const stabilityColor = (flag) => {
    if (!flag || flag === "OK") return "#16a34a";
    return "#b91c1c";
  };

  const chipStyle = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    marginRight: "6px",
    marginBottom: "4px",
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "22px", marginBottom: "10px" }}>Placement Drive (Bulk Match Engine)</h2>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "10px",
          }}
        >
          {error}
        </div>
      )}

      {/* Top Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 2fr",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Job selection */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <h3 style={{ marginBottom: "8px", fontSize: "16px" }}>1. Select Jobs</h3>
          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              border: "1px solid #f3f4f6",
              borderRadius: "6px",
              padding: "6px",
            }}
          >
            {jobs.length === 0 && <p style={{ fontSize: "14px" }}>No jobs found yet.</p>}
            {jobs.map((job) => (
              <label
                key={job.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                  padding: "4px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedJobIds.includes(job.id)}
                  onChange={() => handleJobSelect(job.id)}
                />
                <span>{job.title}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Batch ID + Upload Pool */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <h3 style={{ marginBottom: "8px", fontSize: "16px" }}>2. Upload Candidate Pool</h3>
          <label style={{ fontSize: "14px", display: "block", marginBottom: "6px" }}>
            Batch ID
          </label>
          <input
            type="text"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="e.g., DRIVE-2025-01"
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              marginBottom: "10px",
              fontSize: "14px",
            }}
          />

          <label style={{ fontSize: "14px", display: "block", marginBottom: "6px" }}>
            Resumes (PDF/DOCX/TXT)
          </label>
          <input type="file" multiple onChange={handlePoolFilesChange} />

          <button
            onClick={handleUploadPool}
            disabled={loadingPool}
            style={{
              marginTop: "10px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: loadingPool ? "#9ca3af" : "#2563eb",
              color: "white",
              fontSize: "14px",
              cursor: loadingPool ? "not-allowed" : "pointer",
            }}
          >
            {loadingPool ? "Uploading..." : "Upload to Pool"}
          </button>
        </div>

        {/* Run drive */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px",
          }}
        >
          <h3 style={{ marginBottom: "8px", fontSize: "16px" }}>3. Run Matching</h3>
          <p style={{ fontSize: "13px", marginBottom: "10px" }}>
            This will run semantic matching across the uploaded pool for each selected job,
            and then you can perform deep draconian analysis candidate-by-candidate.
          </p>

          <button
            onClick={handleRunDrive}
            disabled={loadingDrive}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: loadingDrive ? "#9ca3af" : "#059669",
              color: "white",
              fontSize: "14px",
              cursor: loadingDrive ? "not-allowed" : "pointer",
            }}
          >
            {loadingDrive ? "Running Drive..." : "Run Placement Drive"}
          </button>
        </div>
      </div>

      {/* Results */}
      <h3 style={{ fontSize: "18px", marginBottom: "10px" }}>Match Results</h3>
      {Object.keys(driveResults).length === 0 && (
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          Run a drive to see candidates ranked for each job.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {Object.entries(driveResults).map(([jobTitle, candidates]) => (
          <div
            key={jobTitle}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "10px",
              background: "#f9fafb",
            }}
          >
            <h4 style={{ fontSize: "16px", marginBottom: "6px" }}>{jobTitle}</h4>
            {(!candidates || candidates.length === 0) && (
              <p style={{ fontSize: "13px", color: "#6b7280" }}>No candidates found for this job.</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {candidates.map((c) => {
                const analysis = analysisByCandidateId[c.id];
                const status = analysis?.status;
                const stability = analysis?.stability_flag || "OK";
                return (
                  <div
                    key={c.id}
                    style={{
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ color: "#6b7280" }}>{c.email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "#4b5563" }}>Semantic Match</div>
                        <div style={{ fontWeight: 700 }}>{c.score}%</div>
                      </div>
                    </div>

                    {analysis && (
                      <div style={{ marginTop: "4px" }}>
                        <div style={{ marginBottom: "4px" }}>
                          <span
                            style={{
                              ...chipStyle,
                              background: statusColor(status),
                              color: "white",
                            }}
                          >
                            {status || "Not scored"}
                          </span>
                          <span
                            style={{
                              ...chipStyle,
                              background: stabilityColor(stability),
                              color: "white",
                            }}
                          >
                            Stability: {stability}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#4b5563" }}>
                          Overall Score:{" "}
                          <strong>{analysis.score != null ? analysis.score : "N/A"}</strong>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleDeepAnalyze(c.job_id, c.id)}
                      disabled={analyzingId === c.id}
                      style={{
                        marginTop: "6px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        background: analyzingId === c.id ? "#9ca3af" : "#2563eb",
                        color: "white",
                        cursor: analyzingId === c.id ? "wait" : "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {analyzingId === c.id ? "Analyzing..." : "Deep Analyze (Draconian Score)"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Analysis Detail Panel */}
      {selectedAnalysis && (
        <div
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: "360px",
            height: "100vh",
            background: "white",
            borderLeft: "1px solid #e5e7eb",
            boxShadow: "-4px 0 12px rgba(0,0,0,0.06)",
            padding: "16px",
            overflowY: "auto",
            zIndex: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Draconian Analysis</h3>
            <button
              onClick={closeAnalysisPanel}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: "13px" }}>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontWeight: 600 }}>{selectedAnalysis.name}</div>
              <div style={{ color: "#6b7280" }}>{selectedAnalysis.email}</div>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <span
                style={{
                  ...chipStyle,
                  background: statusColor(selectedAnalysis.status),
                  color: "white",
                }}
              >
                {selectedAnalysis.status}
              </span>
              <span
                style={{
                  ...chipStyle,
                  background: stabilityColor(selectedAnalysis.stability_flag),
                  color: "white",
                }}
              >
                Stability: {selectedAnalysis.stability_flag}
              </span>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Score Breakdown</div>
              <div>Overall Score: {selectedAnalysis.score}</div>
              <div>Experience Score: {selectedAnalysis.experience_score}</div>
              <div>Skills Score: {selectedAnalysis.skills_score}</div>
              <div>Role Alignment Score: {selectedAnalysis.role_alignment_score}</div>
            </div>

            <div
              style={{
                border: "1px solid #fee2e2",
                background: "#fef2f2",
                borderRadius: "8px",
                padding: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px", color: "#b91c1c" }}>
                Missing Skills
              </div>
              {selectedAnalysis.missing_skills && selectedAnalysis.missing_skills.length > 0 ? (
                selectedAnalysis.missing_skills.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      ...chipStyle,
                      background: "#fecaca",
                      color: "#7f1d1d",
                    }}
                  >
                    {s}
                  </span>
                ))
              ) : (
                <div style={{ fontSize: "12px", color: "#6b7280" }}>None listed</div>
              )}
            </div>

            <div
              style={{
                border: "1px solid #dcfce7",
                background: "#f0fdf4",
                borderRadius: "8px",
                padding: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px", color: "#166534" }}>
                Skills Found
              </div>
              {selectedAnalysis.skills_found && selectedAnalysis.skills_found.length > 0 ? (
                selectedAnalysis.skills_found.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      ...chipStyle,
                      background: "#bbf7d0",
                      color: "#14532d",
                    }}
                  >
                    {s}
                  </span>
                ))
              ) : (
                <div style={{ fontSize: "12px", color: "#6b7280" }}>None listed</div>
              )}
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Reasoning</div>
              <p style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "#374151" }}>
                {selectedAnalysis.reasoning || "No reasoning returned."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkMatch;
