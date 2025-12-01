import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '1.5rem', border: '1px solid #e5e7eb' }}>
      {/* Header Line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="skeleton" style={{ height: '24px', width: '200px', borderRadius: '4px' }}></div>
        <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '12px' }}></div>
      </div>
      
      {/* Body Lines */}
      <div className="skeleton" style={{ height: '16px', width: '100%', marginBottom: '8px', borderRadius: '4px' }}></div>
      <div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '4px' }}></div>
    </div>
  );
}