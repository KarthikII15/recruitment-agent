import React, { useState } from 'react';
import apiClient from './api/client';
import SkeletonCard from './components/SkeletonCard'; // Import the new component
import { Search, User, Loader } from 'lucide-react'; // Add Loader icon

export default function Matchmaker() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('job_description', query);

    try {
      // Calls the Vector DB endpoint we built
      const response = await apiClient.post('/match/', formData);
      setResults(response.data.matches);
    } catch (error) {
      console.error(error);
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search /> AI Talent Search
      </h1>

      {/* SEARCH BOX */}
      <div className="card">
        <h2>Find the perfect candidate</h2>
        <p>Search across ALL resumes using natural language.</p>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="e.g. 'Looking for a Data Scientist with 5 years Python experience'" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Searching...' : 'Find Matches'}
          </button>
        </form>
      </div>

      {/* RESULTS LIST */}
      <div className="card">
        <h2>Top Matches ({loading ? '...' : results.length})</h2>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          
          {/* A. SHOW SKELETONS WHILE LOADING */}
          {loading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {/* B. SHOW RESULTS WHEN DONE */}
          {!loading && results.map((match, index) => (
            <div key={index} style={{ 
              border: '1px solid #e5e7eb', 
              padding: '1rem', 
              borderRadius: '8px',
              backgroundColor: index === 0 ? '#f0fdf4' : 'white',
              transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} /> {match.metadata.name || "Unknown Candidate"}
                </h3>
                <span style={{ 
                  backgroundColor: '#dbeafe', color: '#1e40af', 
                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold'
                }}>
                  {(match.score * 100).toFixed(1)}% Match
                </span>
              </div>
              
              <p style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.9rem' }}>
                <strong>Key Skills:</strong> {match.metadata.skills ? match.metadata.skills.substring(0, 150) + "..." : "No analysis available"}
              </p>
            </div>
          ))}
          
          {!loading && results.length === 0 && (
             <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
               {query ? "No matches found." : "Enter a query to see the magic."}
             </p>
          )}
        </div>
      </div>
    </div>
  );
}