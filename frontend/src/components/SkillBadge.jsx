// frontend/src/components/SkillBadge.jsx
import React from "react";

const SkillBadge = ({ label, type = "matched" }) => {
  const isMissing = type === "missing";
  const bg = isMissing ? "#fee2e2" : "#dcfce7";
  const color = isMissing ? "#b91c1c" : "#15803d";

  if (!label) return null;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        background: bg,
        color,
        marginRight: "4px",
        marginBottom: "4px",
      }}
    >
      {label}
    </span>
  );
};

export default SkillBadge;
