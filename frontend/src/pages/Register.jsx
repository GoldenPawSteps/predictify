import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' },
  card: { background: 'var(--surface)', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', width: '100%', maxWidth: '400px' },
  title: { margin: '0 0 1.5rem', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' },
  label: { display: 'block', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--text-secondary)' },
  input: { width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border-input)', borderRadius: '4px', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '1rem', background: 'var(--surface)', color: 'var(--text-primary)' },
  button: { width: '100%', padding: '0.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' },
  error: { background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' },
  link: { marginTop: '1rem', textAlign: 'center', color: 'var(--text-faint2)', fontSize: '0.9rem' },
};

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { dark, mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/markets');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <button onClick={toggleTheme} title={mode === 'auto' ? 'Auto (system)' : mode === 'light' ? 'Light' : 'Dark'} style={{ position: 'fixed', top: '1rem', right: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '1rem' }}>{mode === 'auto' ? '💻' : mode === 'light' ? '☀️' : '🌙'}</button>
      <div style={styles.card}>
        <h1 style={styles.title}>🎯 Predictify</h1>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', color: '#333' }}>Create Account</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Username</label>
          <input style={styles.input} type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button style={styles.button} type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
        </form>
        <p style={styles.link}>Already have an account? <Link to="/login">Sign In</Link></p>
      </div>
    </div>
  );
}
