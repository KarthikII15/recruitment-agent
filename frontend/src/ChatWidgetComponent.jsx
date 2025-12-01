// frontend/src/ChatWidget.jsx

import React, { useState, useEffect, useMemo } from "react";
import api from "./api/client";
import "./ChatWidget.css"; // Import the new CSS

/**
 * Floating AI Recruiter Assistant
 *
 * - Bubble at bottom-right
 * - Expands to sliding panel
 * - Auto-resizes based on response size / type
 * - Sends context (currentView) to backend
 */
const ChatWidget = ({ currentView }) => {
  const [open, setOpen] = useState(false);
  const [panelSize, setPanelSize] = useState("small"); // small | medium | large
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "assistant",
      text:
        "Hi! I’m your AI Recruiter Assistant. Ask me about jobs, candidates, scores or summaries.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  // --- Panel sizing logic ---
  const panelStyle = useMemo(() => {
    // base style
    const base = {
      position: "fixed",
      bottom: "80px",
      right: "20px",
      background: "#0b1120",
      color: "white",
      borderRadius: "18px",
      boxShadow: "0 20px 40px rgba(15,23,42,0.4)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      zIndex: 1000,
      transition: "all 0.25s ease",
    };

    if (panelSize === "small") {
      return { ...base, width: "320px", height: "360px" };
    }
    if (panelSize === "medium") {
      return { ...base, width: "380px", height: "480px" };
    }
    // large
    return { ...base, width: "420px", height: "80vh" };
  }, [panelSize]);

  const computePanelSize = (text) => {
    if (!text) return "small";
    const len = text.length;

    if (len < 280) return "small";
    if (len < 900) return "medium";
    return "large";
  };

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chat/", {
        question: trimmed,
        context: {
          view: currentView || "unknown",
          // place for more context in future (job_id, candidate_id, etc.)
        },
      });

      let reply = res.data?.response;

      // Support both: plain string or object { reply, action }
      let replyText = "";
      if (typeof reply === "string") {
        replyText = reply;
      } else if (reply && typeof reply === "object") {
        replyText = reply.reply || JSON.stringify(reply, null, 2);
      } else {
        replyText = "I’m not sure how to respond to that.";
      }

      const assistantMessage = {
        id: Date.now() + 1,
        sender: "assistant",
        text: replyText,
      };

      // Resize panel based on reply
      setPanelSize(computePanelSize(replyText));
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: "assistant",
          text:
            "Something went wrong connecting to the assistant. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // auto-expand to at least medium the first time it opens
  useEffect(() => {
    if (open && messages.length === 1) {
      setPanelSize("medium");
    }
  }, [open, messages.length]);

  return (
    <>
      {/* Floating Bubble (New Design) */}
      {!open && (
        <div className="ai-chat-container" onClick={() => setOpen(true)}>
          <div className="ai-chat-tooltip">Open AI Recruiter Assistant</div>

          <div className="ai-chat-button">
            <span className="text-primary">⚡</span>
            <span className="text-secondary">Ask me anything</span>
          </div>
        </div>
      )}

      {/* Sliding Panel */}
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid rgba(148,163,184,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(56,189,248,0.05))",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#e5e7eb",
                }}
              >
                AI Recruiter Assistant
              </div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                Context: {currentView || "unknown"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {/* Size toggle button (manual override) */}
              <button
                onClick={() =>
                  setPanelSize((prev) =>
                    prev === "small"
                      ? "medium"
                      : prev === "medium"
                        ? "large"
                        : "small"
                  )
                }
                style={{
                  border: "none",
                  background: "rgba(148,163,184,0.25)",
                  color: "#e5e7eb",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
                title="Toggle size"
              >
                ⤢
              </button>

              {/* Close */}
              <button
                onClick={handleToggle}
                style={{
                  border: "none",
                  background: "rgba(148,163,184,0.18)",
                  color: "#e5e7eb",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "10px",
              overflowY: "auto",
              background:
                "radial-gradient(circle at top, rgba(30,64,175,0.3), #020617 55%)",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  marginBottom: "8px",
                  display: "flex",
                  justifyContent:
                    m.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "8px 10px",
                    borderRadius:
                      m.sender === "user"
                        ? "12px 12px 2px 12px"
                        : "12px 12px 12px 2px",
                    background:
                      m.sender === "user"
                        ? "linear-gradient(135deg,#4f46e5,#2563eb)"
                        : "rgba(15,23,42,0.9)",
                    color: "white",
                    fontSize: "13px",
                    whiteSpace: "pre-wrap",
                    border:
                      m.sender === "assistant"
                        ? "1px solid rgba(148,163,184,0.4)"
                        : "none",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ marginTop: "4px", fontSize: "12px", color: "#9ca3af" }}>
                Thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "8px",
              borderTop: "1px solid rgba(148,163,184,0.4)",
              background: "#020617",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about jobs, candidates, scores..."
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                borderRadius: "10px",
                border: "1px solid rgba(148,163,184,0.4)",
                padding: "6px 8px",
                fontSize: "13px",
                background: "rgba(15,23,42,0.8)",
                color: "#e5e7eb",
                outline: "none",
                marginBottom: "6px",
              }}
            />

            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: "100%",
                padding: "7px",
                borderRadius: "9px",
                border: "none",
                background:
                  loading || !input.trim()
                    ? "rgba(148,163,184,0.4)"
                    : "linear-gradient(135deg,#4f46e5,#2563eb)",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending..." : "Ask Assistant"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
