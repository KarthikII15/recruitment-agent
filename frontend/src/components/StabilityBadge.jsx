// frontend/src/components/StabilityBadge.jsx
import React from "react";

const StabilityBadge = ({ flag }) => {
  const value = (flag || "OK").toUpperCase();
  const isRisk = value === "RISK";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        background: isRisk ? "#fee2e2" : "#dcfce7",
        color: isRisk ? "#b91c1c" : "#16a34a",
        marginLeft: "6px",
      }}
    >
      Stability: {value}
    </span>
  );
};

export default StabilityBadge;
