// ----------------------
// BULK AUTODRIVE (STREAMING READY VERSION)
// ----------------------

import React, { useState, useRef, useEffect } from "react";
import api from "../api/client";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import ScoreBar from "./ScoreBar";

/* ------------------------- SCORE RING ------------------------- */
const ScoreRing = ({ score }) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = ((score || 0) / 100) * c;

  return (
    <div style={{ width: 44, height: 44, position: "relative" }}>
      <svg width="44" height="44" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="22" cy="22" r={r} stroke="#e5e7eb" strokeWidth="4" fill="none" />
        <circle
          cx="22"
          cy="22"
          r={r}
          stroke="#3b82f6"
          strokeWidth="4"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - pct}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          fontSize: "11px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontWeight: 700,
        }}
      >
        {Math.round(score || 0)}
      </span>
    </div>
  );
};

/* ------------------------- SKILL CHIP ------------------------- */
const SkillChip = ({ text, color }) => (
  <span
    style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "11px",
      color: "white",
      background: color,
      marginRight: 6,
      marginBottom: 6,
      fontWeight: 500,
    }}
  >
    {text}
  </span>
);

/* ------------------------- FILE ICON HELPERS ------------------------- */
const getFileIcon = (name) => {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📕";
  if (ext === "doc" || ext === "docx") return "📘";
  return "📄";
};

const prettySize = (bytes) => {
  if (!bytes) return "0 KB";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
};

/* ------------------------- FILE UPLOADER ------------------------- */
const FileUploader = ({
  title,
  files,
  setFiles,
  loading,
  onUpload,
  buttonLabel,
  color,
}) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  return (
    <div
      style={{
        border: dragging ? "3px dashed #3b82f6" : "2px dashed #cbd5e1",
        borderRadius: "12px",
        padding: 20,
        background: dragging ? "#eff6ff" : "#f9fafb",
        transition: "0.25s",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <h3 style={{ fontWeight: 700, marginBottom: 12 }}>{title}</h3>

      {/* file selection */}
      <label
        style={{
          display: "block",
          textAlign: "center",
          padding: 14,
          background: "white",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          cursor: "pointer",
        }}
      >
        📁 Click to Select Files
        <input
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => setFiles((p) => [...p, ...Array.from(e.target.files)])}
        />
      </label>

      {/* file preview grid */}
      {files.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                background: "white",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                position: "relative",
              }}
            >
              <div style={{ fontSize: 26 }}>{getFileIcon(f.name)}</div>
              <strong style={{ fontSize: 13 }}>{f.name}</strong>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {prettySize(f.size)}
              </div>

              {/* fake loading bar */}
              {loading && (
                <div
                  style={{
                    marginTop: 6,
                    height: 6,
                    background: "#e5e7eb",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ background: color, height: "100%" }}
                  />
                </div>
              )}

              <button
                onClick={() =>
                  setFiles((p) => p.filter((_, idx) => idx !== i))
                }
                style={{
                  position: "absolute",
                  right: 6,
                  top: 6,
                  background: "#fecaca",
                  color: "#b91c1c",
                  border: "none",
                  padding: "2px 6px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onUpload}
        disabled={loading}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 10,
          borderRadius: 10,
          border: "none",
          background: loading ? "#9ca3af" : color,
          color: "white",
          fontWeight: 600,
        }}
      >
        {loading ? "Uploading..." : buttonLabel}
      </button>
    </div>
  );
};

/* ===============================================================
   MAIN COMPONENT — WEBSOCKET STREAMING
=============================================================== */
const BulkAutoDrive = () => {
  const [jdFiles, setJdFiles] = useState([]);
  const [resumeFiles, setResumeFiles] = useState([]);

  const [jobIds, setJobIds] = useState([]);
  const [candidateIds, setCandidateIds] = useState([]);

  const [results, setResults] = useState({});
  const [open, setOpen] = useState({});
  const [error, setError] = useState("");

  const [loadingJds, setLoadingJds] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [loadingAutoDrive, setLoadingAutoDrive] = useState(false);

  const bottomRef = useRef(null);

  /* --- Auto scroll when new results stream --- */
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  /* ---------------------- UPLOAD HANDLERS ---------------------- */
  const uploadJds = async () => {
    if (!jdFiles.length) return setError("Please select JD files.");
    setError("");
    setLoadingJds(true);

    try {
      const fd = new FormData();
      jdFiles.forEach((f) => fd.append("files", f));

      const res = await api.post("/bulk/jds/", fd);
      setJobIds(res.data.created_job_ids || []);
    } catch (err) {
      console.error(err);
      setError("Failed to upload JDs");
    } finally {
      setLoadingJds(false);
    }
  };

  const uploadResumes = async () => {
    if (!resumeFiles.length) return setError("Please select resumes.");
    setError("");
    setLoadingResumes(true);

    try {
      const fd = new FormData();
      resumeFiles.forEach((f) => fd.append("files", f));

      const res = await api.post("/bulk/resumes/", fd);
      setCandidateIds(res.data.candidate_ids || []);
    } catch (err) {
      console.error(err);
      setError("Failed to upload resumes.");
    } finally {
      setLoadingResumes(false);
    }
  };

  /* ---------------------- START AUTODRIVE + STREAM ---------------------- */
  const runAutoDrive = async () => {
    if (!jobIds.length || !candidateIds.length) {
      return setError("Upload JDs & resumes first.");
    }

    setError("");
    setResults({});
    setLoadingAutoDrive(true);

    try {
      await api.post("/bulk/autodrive/start", {
        job_ids: jobIds,
        candidate_ids: candidateIds,
      });
    } catch (err) {
      setError("Failed to start AutoDrive.");
      setLoadingAutoDrive(false);
      return;
    }

    const token = localStorage.getItem("token");
    const socket = new WebSocket(`ws://${window.location.hostname}:8000/ws/autodrive?token=${token}`);


    socket.onopen = () => console.log("WebSocket connected");
    socket.onerror = () => setError("Streaming connection failed.");
    socket.onclose = () => setLoadingAutoDrive(false);

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); }
      catch { return; }

      if (data.type === "result") {
        setResults((prev) => {
          const job = data.job_key;
          const updated = { ...prev };
          if (!updated[job]) updated[job] = [];
          updated[job].push(data.candidate);
          return updated;
        });
      }

      if (data.type === "done") {
        socket.close();
      }

      if (data.type === "error") {
        setError(data.msg);
      }
    };
  };

  /* ---------------------- EXPAND/COLLAPSE ---------------------- */
  const toggle = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));
  const expandAll = () => {
    const tmp = {};
    Object.entries(results).forEach(([job, arr]) =>
      arr.forEach((c) => (tmp[`${job}-${c.candidate_id}`] = true))
    );
    setOpen(tmp);
  };
  const collapseAll = () => setOpen({});

  /* ---------------------- RENDER ---------------------- */
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700 }}>Super Bulk Auto-Drive</h2>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
            color: "#b91c1c",
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* UPLOAD GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <FileUploader
          title="Upload JD Documents"
          files={jdFiles}
          setFiles={setJdFiles}
          loading={loadingJds}
          onUpload={uploadJds}
          buttonLabel="Upload & Parse JDs"
          color="#2563eb"
        />

        <FileUploader
          title="Upload Resumes"
          files={resumeFiles}
          setFiles={setResumeFiles}
          loading={loadingResumes}
          onUpload={uploadResumes}
          buttonLabel="Upload Resumes"
          color="#059669"
        />
      </div>

      {/* RUN BUTTON */}
      <button
        onClick={runAutoDrive}
        disabled={loadingAutoDrive}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          background: loadingAutoDrive ? "#9ca3af" : "#7c3aed",
          color: "white",
          border: "none",
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        {loadingAutoDrive ? "Running & Streaming..." : "Run Auto-Drive (Live)"}
      </button>

      {/* RESULTS */}
      {Object.keys(results).length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={expandAll}
              style={{ padding: "6px 12px", background: "#3b82f6", color: "white", borderRadius: 6 }}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              style={{ padding: "6px 12px", background: "#6b7280", color: "white", borderRadius: 6 }}
            >
              Collapse All
            </button>
          </div>

          {Object.entries(results).map(([jobLabel, candidates]) => (
            <div
              key={jobLabel}
              style={{
                marginTop: 30,
                padding: 20,
                background: "white",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            >
              <h3 style={{ fontSize: 20, marginBottom: 12 }}>{jobLabel}</h3>

              {candidates.map((c, idx) => {
                const key = `${jobLabel}-${c.candidate_id}`;
                const opened = open[key];

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: 14,
                      background: "#f9fafb",
                      marginBottom: 12,
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      cursor: "pointer",
                    }}
                    onClick={() => toggle(key)}
                  >
                    {/* HEADER */}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <strong>{c.candidate_name}</strong>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>ID: {c.candidate_id}</div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ScoreRing score={c.deep_score} />
                        {opened ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </div>

                    {/* EXPANDED CONTENT */}
                    <AnimatePresence>
                      {opened && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: "hidden", marginTop: 12 }}
                        >
                          <ScoreBar label="Experience Match" score={c.experience_score} max={30} />
                          <ScoreBar label="Skills Match" score={c.skills_score} max={40} />
                          <ScoreBar label="Role Alignment" score={c.role_alignment_score} max={30} />

                          <div style={{ marginTop: 12 }}>
                            <strong>Matched Skills</strong>
                            <div style={{ marginTop: 6 }}>
                              {(c.skills_found || []).map((s, i) => (
                                <SkillChip key={i} text={s} color="#1d4ed8" />
                              ))}
                            </div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <strong>Missing Skills</strong>
                            <div style={{ marginTop: 6 }}>
                              {(c.missing_skills || []).map((s, i) => (
                                <SkillChip key={i} text={s} color="#dc2626" />
                              ))}
                            </div>
                          </div>

                          <div style={{ marginTop: 14 }}>
                            <strong>AI Reasoning</strong>
                            <p style={{ fontSize: 13, marginTop: 6 }}>{c.reasoning}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default BulkAutoDrive;
