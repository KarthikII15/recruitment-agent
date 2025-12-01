import React, { useState } from "react";
import api from "./api/client";
import { Cloud, Loader, CheckCircle, XCircle } from "lucide-react";

const CloudDeploy = () => {
  const [provider] = useState("gcp");
  const [region, setRegion] = useState("us-central1");
  const [projectId, setProjectId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [machineType, setMachineType] = useState("e2-medium");

  const [deploymentId, setDeploymentId] = useState(null);
  const [status, setStatus] = useState(null);
  const [appUrl, setAppUrl] = useState(null);
  const [publicIp, setPublicIp] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const startDeployment = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        provider,
        region,
        project_id: projectId,
        service_account_json: serviceAccountJson,
        machine_type: machineType,
      };
      const res = await api.post("/deploy/start", payload);
      setDeploymentId(res.data.id);
      setStatus(res.data.status);
      setAppUrl(res.data.app_url);
      setPublicIp(res.data.public_ip);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Deployment failed to start");
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!deploymentId) return;
    try {
      const res = await api.get(`/deploy/${deploymentId}/status`);
      setStatus(res.data.status);
      setAppUrl(res.data.app_url);
      setPublicIp(res.data.public_ip);
      setError(res.data.error_message || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to fetch status");
    }
  };

  const undeploy = async () => {
    if (!deploymentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/deploy/undeploy", {
        deployment_id: deploymentId,
      });
      setStatus(res.data.status);
      setAppUrl(res.data.app_url);
      setPublicIp(res.data.public_ip);
      setError(res.data.error_message || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to undeploy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Cloud size={24} /> Cloud Deployment (GCP)
      </h2>
      <p style={{ color: "#64748b" }}>
        Deploy the Recruitment Agent to your GCP project. We will create a VM in{" "}
        <code>us-central1</code>, clone your GitHub repo, and run docker-compose.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
              Region
            </label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-central1"
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
              Machine Type
            </label>
            <input
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
              placeholder="e2-medium"
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
            GCP Project ID
          </label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="your-gcp-project-id"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
            Service Account JSON
          </label>
          <textarea
            value={serviceAccountJson}
            onChange={(e) => setServiceAccountJson(e.target.value)}
            placeholder="Paste the full service account JSON here"
            rows={6}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            This is used only to create/destroy the VM in your project.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={startDeployment}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            {loading && <Loader size={16} className="spin" />}
            Deploy
          </button>

          <button
            onClick={refreshStatus}
            disabled={!deploymentId}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #cbd5f5",
              background: "#f8fafc",
              cursor: deploymentId ? "pointer" : "not-allowed",
            }}
          >
            Refresh Status
          </button>

          <button
            onClick={undeploy}
            disabled={!deploymentId}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              cursor: deploymentId ? "pointer" : "not-allowed",
            }}
          >
            Undeploy
          </button>
        </div>
      </div>

      {status && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <h4 style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {status === "running" ? (
              <CheckCircle size={18} color="#22c55e" />
            ) : status === "error" ? (
              <XCircle size={18} color="#ef4444" />
            ) : (
              <Loader size={18} className="spin" />
            )}
            Deployment Status: {status}
          </h4>
          {appUrl && (
            <p>
              App URL:{" "}
              <a href={appUrl} target="_blank" rel="noreferrer">
                {appUrl}
              </a>
            </p>
          )}
          {publicIp && <p>Public IP: {publicIp}</p>}
          {error && (
            <p style={{ color: "#b91c1c", fontSize: 13 }}>
              Error: {String(error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CloudDeploy;
