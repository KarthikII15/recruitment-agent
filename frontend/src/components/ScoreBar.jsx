// frontend/src/components/ScoreBar.jsx
import React from "react";

const ScoreBar = ({ label, score = 0, max = 30 }) => {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));

  return (
    <div style={{ marginBottom: "6px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#4b5563",
          marginBottom: "2px",
        }}
      >
        <span>{label}</span>
        <span>
          {score}/{max}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "6px",
          borderRadius: "999px",
          background: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#3b82f6",
            transition: "width 0.15s linear",
          }}
        />
      </div>
    </div>
  );
};

export default ScoreBar;
