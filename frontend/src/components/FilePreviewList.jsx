// frontend/src/components/FilePreviewList.jsx
import React from "react";

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const getIcon = (name = "") => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "📕";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "📘";
  if (lower.endsWith(".txt")) return "📄";
  return "📁";
};

function FilePreviewList({ files, onRemove }) {
  if (!files || files.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "8px",
        padding: "8px",
        background: "#f1f5f9",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
        maxHeight: "160px",
        overflowY: "auto",
        fontSize: "12px",
      }}
    >
      {files.map((file, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0",
            borderBottom:
              idx === files.length - 1 ? "none" : "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{getIcon(file.name)}</span>
            <span>{file.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#475569" }}>{formatSize(file.size)}</span>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FilePreviewList;
