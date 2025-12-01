import React, { useState, useEffect } from 'react';
import apiClient from './api/client';
import { Briefcase, Plus, Upload, FileText, Download, Loader, Check, X, Trash2, AlertTriangle, Info } from 'lucide-react';
import { useDashboard } from './context/DashboardContext';

// --- SUB-COMPONENT: Notification Toast ---
const Toast = ({ message, type, onClose }) => (
  <div className={`toast-card ${type === 'error' ? 'toast-error' : 'toast-success'}`}>
    {type === 'success' ? <Check size={20} color="#22c55e" /> : <AlertTriangle size={20} color="#ef4444" />}
    <div style={{ flex: 1 }}>
      <strong>{type === 'success' ? 'Success' : 'Notice'}</strong>
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>{message}</p>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
      <X size={16} />
    </button>
  </div>
);

// --- MAIN COMPONENT ---
export default function JobBoard() {
  const [jobs, setJobs] = useState([]);
  const { globalFilter } = useDashboard(); // From Context

  // UI States
  const [pageLoading, setPageLoading] = useState(true);
  const [createMode, setCreateMode] = useState('text');
  const [newJob, setNewJob] = useState({ title: '', description: '' });
  const [jdFiles, setJdFiles] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // NEW: Notification & Modal States
  const [notification, setNotification] = useState(null); // { message, type }
  const [resultModal, setResultModal] = useState(null); // Data for AI Result Modal
  const [deleteModal, setDeleteModal] = useState(null); // Job ID to delete

  // Helper: Show Notification
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Auto-hide after 4s
  };

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setPageLoading(true);
    try {
      const response = await apiClient.get('/jobs/');
      setJobs(response.data);
    } catch (error) { console.error(error); }
    finally { setPageLoading(false); }
  };

  const handleJdSelect = (e) => {
    if (e.target.files) setJdFiles(prev => [...prev, ...Array.from(e.target.files)]);
  };

  const removeJdFile = (index) => {
    setJdFiles(prev => prev.filter((_, i) => i !== index));
  };

  // CREATE JOB
  const handleCreateJob = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      if (createMode === 'text') {
        const formData = new FormData();
        formData.append('title', newJob.title);
        formData.append('description', newJob.description);
        await apiClient.post('/jobs/', formData);
      } else {
        if (jdFiles.length === 0) { notify("Please select files first!", "error"); setActionLoading(false); return; }
        for (let i = 0; i < jdFiles.length; i++) {
          const fd = new FormData();
          fd.append('file', jdFiles[i]);
          await apiClient.post('/jobs/upload/', fd);
        }
        setJdFiles([]);
      }
      notify("Jobs created successfully!");
      setNewJob({ title: '', description: '' });
      fetchJobs();
    } catch (err) { notify("Failed to create job.", "error"); }
    finally { setActionLoading(false); }
  };

  // DELETE JOB
  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      await apiClient.delete(`/jobs/${deleteModal}`);
      setJobs(prev => prev.filter(job => job.id !== deleteModal));
      notify("Job deleted.");
    } catch (err) { notify("Failed to delete job.", "error"); }
    finally { setDeleteModal(null); }
  };

  // BULK UPLOAD SCREENING
  const handleBulkUpload = async (jobId, files) => {
    if (!files || files.length === 0) return;

    const newQueueItems = Array.from(files).map(file => ({
      id: Math.random(), fileName: file.name, status: 'pending', jobId
    }));
    setProcessingQueue(prev => [...prev, ...newQueueItems]);

    // Only show Modal for the LAST file if single upload, or notify for bulk
    let lastResult = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('job_id', jobId);
      formData.append('file', file);

      try {
        const response = await apiClient.post('/screen/', formData);
        lastResult = response.data; // Capture result

        setProcessingQueue(prev => prev.map(item =>
          item.fileName === file.name ? { ...item, status: 'success' } : item
        ));
      } catch (err) {
        setProcessingQueue(prev => prev.map(item =>
          item.fileName === file.name ? { ...item, status: 'error' } : item
        ));
      }
    }

    // If it was a single file upload, show the detailed Result Modal
    if (files.length === 1 && lastResult) {
      setResultModal(lastResult);
    } else {
      notify("Bulk screening complete. Check queue for status.");
    }
  };

  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes((globalFilter || '').toLowerCase())
  );

  return (
    <div className="container">
      <h1><Briefcase /> Recruitment Dashboard</h1>

      {/* --- NOTIFICATION CONTAINER --- */}
      {notification && (
        <div className="toast-container">
          <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '400px' }}>
            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h2>Delete Job?</h2>
            <p>This will permanently delete this job and all associated candidate data.</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn" style={{ background: '#e5e7eb', color: 'black' }} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="btn" style={{ background: '#ef4444' }} onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- AI RESULT MODAL (The detailed analysis) --- */}
      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: resultModal.status === 'Shortlist' ? '#166534' : '#991b1b' }}>
                {resultModal.status === 'Shortlist' ? '✅ Shortlisted' : '❌ Rejected'}
              </h2>
              <button onClick={() => setResultModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Score: {resultModal.score}/100</h3>
              <p style={{ margin: 0, lineHeight: '1.6' }}>{resultModal.reasoning}</p>
            </div>

            <div>
              <strong>Skills Found:</strong>
              <div style={{ marginTop: '5px', marginBottom: '15px' }}>
                {resultModal.skills_found && resultModal.skills_found.map((skill, i) => (
                  <span key={i} className="skill-tag">{skill}</span>
                ))}
              </div>
            </div>

            {resultModal.missing_skills && resultModal.missing_skills.length > 0 && (
              <div>
                <strong style={{ color: '#b91c1c' }}>Missing Skills:</strong>
                <div style={{ marginTop: '5px' }}>
                  {resultModal.missing_skills.map((skill, i) => (
                    <span key={i} className="skill-tag missing-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <button className="btn" style={{ width: '100%', marginTop: '20px' }} onClick={() => setResultModal(null)}>Close Analysis</button>
          </div>
        </div>
      )}


      {/* --- CREATE JOB SECTION --- */}
      <div className="card">
        <h2>Create New Position</h2>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={() => setCreateMode('text')} style={{ opacity: createMode === 'text' ? 1 : 0.5, backgroundColor: createMode === 'text' ? '#2563eb' : '#9ca3af' }}>Manual Entry</button>
          <button className="btn" onClick={() => setCreateMode('file')} style={{ opacity: createMode === 'file' ? 1 : 0.5, backgroundColor: createMode === 'file' ? '#2563eb' : '#9ca3af' }}>Upload JD Files</button>
        </div>

        <form onSubmit={handleCreateJob}>
          {createMode === 'text' ? (
            <>
              <input type="text" placeholder="Job Title" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
              <textarea placeholder="Description..." value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} required />
              <button type="submit" className="btn" style={{ marginTop: '10px' }} disabled={actionLoading}>
                {actionLoading ? <><Loader className="spinner" size={16} /> Processing...</> : <><Plus size={16} /> Create Job</>}
              </button>
            </>
          ) : (
            <div>
              <div style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                <p style={{ marginBottom: '10px', color: '#666' }}>Drag & Drop PDF Job Descriptions here</p>
                <input id="jd-input" type="file" multiple accept=".pdf,.docx,.txt" onChange={handleJdSelect} style={{ display: 'none' }} />
                <label htmlFor="jd-input" className="btn" style={{ cursor: 'pointer', display: 'inline-block' }}>Select Files</label>
              </div>
              {jdFiles.length > 0 && (
                <div style={{ marginTop: '15px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  {jdFiles.map((file, index) => (
                    <div key={index} style={{ padding: '8px 12px', borderBottom: '1px solid #eee', background: 'white', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{file.name}</span>
                      <button type="button" onClick={() => removeJdFile(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <button type="submit" className="btn" style={{ marginTop: '15px', width: '100%' }} disabled={actionLoading || jdFiles.length === 0}>
                {actionLoading ? <><Loader className="spinner" size={16} /> Uploading...</> : <><Upload size={16} /> Process {jdFiles.length} Files</>}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* --- UPLOAD QUEUE --- */}
      {processingQueue.length > 0 && (
        <div className="card" style={{ background: '#1e293b', color: 'white' }}>
          <h3>Processing Queue</h3>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {processingQueue.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '5px', borderBottom: '1px solid #334155' }}>
                <span>{item.fileName}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {item.status === 'pending' && <><Loader size={14} className="spin" /> Analyzing</>}
                  {item.status === 'success' && <><Check size={14} color="#4ade80" /> Done</>}
                  {item.status === 'error' && <><X size={14} color="#f87171" /> Failed</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- JOB LIST --- */}
      <div className="card" style={{ position: 'relative', minHeight: '200px' }}>
        <h2>Active Jobs</h2>
        {pageLoading && (
          <div className="loading-overlay"><div style={{ textAlign: 'center' }}><Loader className="spinner" size={40} color="#2563eb" /><p>Loading...</p></div></div>
        )}

        {!pageLoading && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredJobs.map((job) => (
              <div key={job.id} style={{ border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '8px', background: '#f9fafb', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0 }}>{job.title}</h3>
                    <button onClick={() => setDeleteModal(job.id)} title="Delete Job" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={16} /></button>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>{job.description.substring(0, 100)}...</p>
                  <button onClick={() => window.location.href = `http://127.0.0.1:8000/export/${job.id}`} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Download size={14} /> Export CSV</button>
                </div>
                <div>
                  <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
                    <input type="file" multiple accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={(e) => handleBulkUpload(job.id, e.target.files)} />
                    <Upload size={16} style={{ verticalAlign: 'middle' }} /> Screen Resumes
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}