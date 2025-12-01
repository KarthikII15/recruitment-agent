import React, { useState, useEffect } from 'react';
import apiClient from './api/client';
import { Users, CheckSquare, Square, Play, Award } from 'lucide-react';
import SkeletonCard from './components/SkeletonCard';

export default function PlacementDrive() {
    const [jobs, setJobs] = useState([]);
    const [selectedJobIds, setSelectedJobIds] = useState([]);
    const [results, setResults] = useState(null); // { "Python Dev": [Candidats...], ... }
    const [loading, setLoading] = useState(false);

    // 1. Fetch Active Jobs
    useEffect(() => {
        apiClient.get('/jobs/').then(res => setJobs(res.data));
    }, []);

    // 2. Toggle Selection
    const toggleJob = (id) => {
        setSelectedJobIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // 3. Run The Drive
    const handleRunDrive = async () => {
        console.log("Running Drive with IDs:", selectedJobIds);
        if (selectedJobIds.length === 0) return alert("Select at least one job.");
        setLoading(true);
        setResults(null);

        try {
            const response = await apiClient.post('/drive/match/', { job_ids: selectedJobIds });
            console.log("Drive Response:", response.data);
            setResults(response.data);
        } catch (err) {
            alert("Error running drive.");
            console.error("Drive Error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <h1><Users /> Placement Drive Engine</h1>
            <p style={{ color: '#666', marginBottom: '20px' }}>Select multiple JDs to automatically find the best candidates for each role from the database.</p>

            {/* --- SELECTION AREA --- */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3>1. Select Roles for this Drive</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '15px 0' }}>
                    {jobs.map(job => (
                        <div
                            key={job.id}
                            onClick={() => toggleJob(job.id)}
                            style={{
                                border: selectedJobIds.includes(job.id) ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                backgroundColor: selectedJobIds.includes(job.id) ? '#eff6ff' : 'white',
                                padding: '10px 15px', borderRadius: '8px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                            }}
                        >
                            {selectedJobIds.includes(job.id) ? <CheckSquare size={18} color="#2563eb" /> : <Square size={18} color="#999" />}
                            <span style={{ fontWeight: 500 }}>{job.title}</span>
                        </div>
                    ))}
                </div>
                <button className="btn" onClick={handleRunDrive} disabled={loading || selectedJobIds.length === 0} style={{ width: '100%' }}>
                    {loading ? 'Processing...' : <><Play size={18} style={{ verticalAlign: 'middle' }} /> Run Auto-Match</>}
                </button>
            </div>

            {/* --- RESULTS AREA (Kanban Board Style) --- */}
            {loading && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>}

            {results && (
                <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px' }}>
                    {Object.entries(results).map(([jobTitle, candidates], idx) => (
                        <div key={idx} style={{
                            minWidth: '320px', background: '#f8fafc',
                            borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column'
                        }}>
                            {/* Column Header */}
                            <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', background: 'white', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                                <h3 style={{ margin: 0, color: '#1e293b' }}>{jobTitle}</h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{candidates.length} Matches Found</span>
                            </div>

                            {/* Candidate List */}
                            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {candidates.length === 0 ? <p style={{ color: '#999', fontStyle: 'italic' }}>No good matches found.</p> : null}

                                {candidates.map(c => (
                                    <div key={c.id} style={{
                                        background: 'white', padding: '12px', borderRadius: '8px',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${c.score > 85 ? '#22c55e' : '#f59e0b'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong>
                                            <span style={{
                                                fontSize: '0.8rem', fontWeight: 'bold',
                                                color: c.score > 85 ? '#166534' : '#b45309',
                                                background: c.score > 85 ? '#dcfce7' : '#fef3c7',
                                                padding: '2px 6px', borderRadius: '4px'
                                            }}>
                                                {c.score}%
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{c.email}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}