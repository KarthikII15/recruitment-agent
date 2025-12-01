// frontend/src/components/CandidateCard.jsx
import React, { useState } from "react";
import ScoreBar from "./ScoreBar";
import SkillBadge from "./SkillBadge";
import StabilityBadge from "./StabilityBadge";

const CandidateCard = ({ candidate, rank }) => {
  const [open, setOpen] = useState(false);

  const {
    candidate_id,
    candidate_name,
    semantic_score,
    deep_score,
    status,
    stability_flag,
    experience_score,
    skills_score,
    role_alignment_score,
    missing_skills,
    skills_found,
    reasoning,
    file_name,
  } = candidate || {};

  const semanticPct = Math.round((semantic_score || 0) * 100);
  const deep = deep_score ?? 0;
  const statusLower = (status || "").toLowerCase();

  const statusBg =
    statusLower === "shortlist"
      ? "#16a34a"
      : statusLower === "reject"
      ? "#b91c1c"
      : "#4b5563";

  const rankIcon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div
      onClick={() => setOpen((prev) => !prev)}
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "10px",
        fontSize: "13px",
        cursor: "pointer",
        boxShadow: open
          ? "0 10px 25px rgba(15,23,42,0.12)"
          : "0 1px 3px rgba(15,23,42,0.06)",
        transform: open ? "translateY(-1px)" : "translateY(0)",
        transition: "box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease",
      }}
    >
      {/* Header row (always visible) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{rankIcon}</span>
            <span style={{ fontWeight: 600 }}>{candidate_name || "Unknown Candidate"}</span>
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#6b7280",
              marginTop: "2px",
            }}
          >
            Candidate ID: {candidate_id}
          </div>
          {file_name && (
            <div style={{ fontSize: "12px", color: "#6b7280" }}>📄 {file_name}</div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "11px",
              background: statusBg,
              color: "white",
              marginBottom: "4px",
            }}
          >
            {status || "Pending"}
          </div>
          <StabilityBadge flag={stability_flag} />
          <div style={{ marginTop: "4px", fontSize: "12px", color: "#4b5563" }}>
            Semantic: <strong>{semanticPct}%</strong>
          </div>
          <div style={{ fontSize: "12px", color: "#4b5563" }}>
            Deep Score: <strong>{deep}</strong>
          </div>
        </div>
      </div>

      {/* Collapsed hint */}
      {!open && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "11px",
            color: "#6b7280",
          }}
        >
          Click to view score breakdown, skills, and reasoning.
        </div>
      )}

      {/* Expanded details */}
      {open && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "8px",
            borderTop: "1px dashed #e5e7eb",
          }}
        >
          {/* Score breakdown */}
          <div style={{ marginBottom: "8px" }}>
            <ScoreBar label="Experience" score={experience_score || 0} max={30} />
            <ScoreBar label="Skills" score={skills_score || 0} max={40} />
            <ScoreBar label="Role Alignment" score={role_alignment_score || 0} max={30} />
          </div>

          {/* Skills */}
          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "#4b5563",
                marginBottom: "2px",
              }}
            >
              Matched Skills
            </div>
            <div>
              {(skills_found || []).length === 0 && (
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>No skills listed.</span>
              )}
              {(skills_found || []).map((s, idx) => (
                <SkillBadge key={idx} label={s} type="matched" />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "#4b5563",
                marginBottom: "2px",
              }}
            >
              Missing Skills
            </div>
            <div>
              {(missing_skills || []).length === 0 && (
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  No critical skills missing.
                </span>
              )}
              {(missing_skills || []).map((s, idx) => (
                <SkillBadge key={idx} label={s} type="missing" />
              ))}
            </div>
          </div>

          {/* Reasoning */}
          {reasoning && (
            <div
              style={{
                marginTop: "4px",
                padding: "8px",
                borderRadius: "6px",
                background: "#f9fafb",
                fontSize: "12px",
                color: "#4b5563",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                AI Reasoning
              </div>
              <div style={{ whiteSpace: "pre-line" }}>{reasoning}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CandidateCard;
