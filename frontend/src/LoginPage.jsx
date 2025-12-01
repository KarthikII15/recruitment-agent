import React, { useState } from 'react';
import apiClient from './api/client';
import { Lock, Mail, User, LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        await apiClient.post('/register/', formData);
        alert("✅ Account created! Please log in.");
        setIsRegister(false); 
      } else {
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);
        const res = await apiClient.post('/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        localStorage.setItem('token', res.data.access_token);
        window.location.reload(); 
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
      <div className="card" style={{ width: '350px', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', background: 'white' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '50px', height: '50px', background: '#2563eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Lock color="white" size={24} /></div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
        </div>
        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ position: 'relative' }}>
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
                <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
            </div>
          </div>
          <button type="submit" className="btn" style={{ width: '100%', padding: '12px' }} disabled={loading}>{loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Login')}</button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem' }}><button onClick={() => { setIsRegister(!isRegister); setError(null); }} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>{isRegister ? 'Login instead' : 'Create an account'}</button></div>
      </div>
    </div>
  );
}