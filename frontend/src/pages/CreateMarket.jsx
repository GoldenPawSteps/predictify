import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

function liquidityCost(probabilities, beta) {
  const minP = Math.min(...probabilities);
  if (minP <= 0) return Infinity;
  return -beta / Math.log(minP);
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--page-bg)' },
  nav: { background: '#1a1a2e', padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  navTitle: { color: '#fff', fontSize: '1.5rem', fontWeight: '700', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' },
  navUser: { color: '#a5b4fc', fontSize: '0.9rem' },
  main: { maxWidth: '680px', margin: '2rem auto', padding: '0 1rem' },
  card: { background: 'var(--surface)', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
  h1: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: 0 },
  label: { display: 'block', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--text-secondary)', fontSize: '0.95rem' },
  input: { width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border-input)', borderRadius: '4px', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '1rem', background: 'var(--surface)', color: 'var(--text-primary)' },
  row: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' },
  outcomeInput: { flex: 2, padding: '0.5rem', border: '1px solid var(--border-input)', borderRadius: '4px', fontSize: '1rem', background: 'var(--surface)', color: 'var(--text-primary)' },
  probInput: { flex: 1, padding: '0.5rem', border: '1px solid var(--border-input)', borderRadius: '4px', fontSize: '1rem', background: 'var(--surface)', color: 'var(--text-primary)' },
  removeBtn: { background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: '600', flexShrink: 0 },
  addBtn: { background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', marginBottom: '1.5rem' },
  infoBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' },
  warnBox: { background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', color: '#b91c1c' },
  submitBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', width: '100%' },
  backLink: { color: 'var(--link)', textDecoration: 'none', fontSize: '0.9rem' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  themeBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
};

const DRAFT_KEY = 'createMarketDraft';

export default function CreateMarket() {
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; } })();
  const [question, setQuestion] = useState(saved.question || '');
  const [description, setDescription] = useState(saved.description || '');
  const [outcomes, setOutcomes] = useState(saved.outcomes || ['Yes', 'No']);
  const [probabilities, setProbabilities] = useState(saved.probabilities || [0.5, 0.5]);
  const [beta, setBeta] = useState(saved.beta ?? 10);
  const [endTime, setEndTime] = useState(saved.endTime || '');
  const [stmtEndTimeMin, setStmtEndTimeMin] = useState(saved.stmtEndTimeMin || '');
  const [stmtEndTimeMax, setStmtEndTimeMax] = useState(saved.stmtEndTimeMax || '');
  const [tags, setTags] = useState(saved.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout, refreshUser } = useAuth();
  const { dark, mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Persist draft on every change
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ question, description, tags, outcomes, probabilities, beta, endTime, stmtEndTimeMin, stmtEndTimeMax }));
  }, [question, description, tags, outcomes, probabilities, beta, endTime, stmtEndTimeMin, stmtEndTimeMax]);

  const probSum = probabilities.reduce((a, b) => a + Number(b), 0);
  const normalizedProbs = probabilities.map(p => Number(p) / probSum);
  const L = probSum > 0 && beta > 0 ? liquidityCost(normalizedProbs, beta) : Infinity;
  const canAfford = user && isFinite(L) && user.balance >= L;

  function addOutcome() {
    const n = outcomes.length + 1;
    setOutcomes([...outcomes, `Outcome ${n}`]);
    setProbabilities([...probabilities, 1 / n]);
  }

  function removeOutcome(i) {
    if (outcomes.length <= 2) return;
    setOutcomes(outcomes.filter((_, idx) => idx !== i));
    setProbabilities(probabilities.filter((_, idx) => idx !== i));
  }

  function setOutcome(i, val) {
    const updated = [...outcomes]; updated[i] = val; setOutcomes(updated);
  }

  function setProb(i, val) {
    const updated = [...probabilities]; updated[i] = val; setProbabilities(updated);
  }

  function normalizeAll() {
    const sum = probabilities.reduce((a, b) => a + Number(b), 0);
    if (sum > 0) setProbabilities(probabilities.map(p => Number(p) / sum));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canAfford) { setError(`Insufficient balance. Need ${isFinite(L) ? L.toFixed(4) : '?'}`); return; }
    setLoading(true);
    try {
      const res = await api.post('/markets', {
        question,
        description: description.trim() || undefined,
        tags,
        outcomes,
        probabilities: normalizedProbs,
        liquidity_beta: Number(beta),
        end_time: new Date(endTime).toISOString(),
        stmt_end_time_min: stmtEndTimeMin ? new Date(stmtEndTimeMin).toISOString() : undefined,
        stmt_end_time_max: stmtEndTimeMax ? new Date(stmtEndTimeMax).toISOString() : undefined,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      await refreshUser();
      navigate(`/markets/${res.data.market.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <Link to="/markets" style={styles.navTitle}>🎯 Predictify</Link>
        <div style={styles.navLinks}>
          <Link to="/portfolio" style={styles.navLink}>Portfolio</Link>
          <span style={styles.navUser}>💰 {user?.balance?.toFixed(2)}</span>
          <span style={styles.navUser}>{user?.username}</span>
          <button style={styles.themeBtn} onClick={toggleTheme} title={mode === 'auto' ? 'Auto (system)' : mode === 'light' ? 'Light' : 'Dark'}>{mode === 'auto' ? '💻' : mode === 'light' ? '☀️' : '🌙'}</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <div style={styles.main}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/markets" style={styles.backLink}>← Back to Markets</Link>
        </div>
        <div style={styles.card}>
          <h1 style={styles.h1}>Create Prediction Market</h1>
          {error && <div style={styles.errorBox}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Question</label>
            <input style={styles.input} type="text" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Will X happen by Y?" required />

            <label style={styles.label}>Description <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span></label>
            <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '4rem', fontFamily: 'inherit' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide additional context or resolution criteria..." />

            <label style={styles.label}>Tags <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span></label>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {tags.map((t, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--tag-bg)', color: 'var(--tag-text)', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}>
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tag-text)', marginLeft: '0.3rem', padding: 0, fontSize: '0.85rem', lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <input
              style={styles.input}
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const val = tagInput.trim().toLowerCase().replace(/,/g, '');
                  if (val && !tags.includes(val) && tags.length < 10) setTags([...tags, val]);
                  setTagInput('');
                }
              }}
              placeholder="Type a tag and press Enter or comma"
            />

            <label style={styles.label}>Outcomes &amp; Probabilities</label>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
              <span style={{ flex: 2 }}>Outcome</span>
              <span style={{ flex: 1 }}>Probability</span>
              <span style={{ width: '40px' }}></span>
            </div>
            {outcomes.map((o, i) => (
              <div key={i} style={styles.row}>
                <input style={styles.outcomeInput} value={o} onChange={e => setOutcome(i, e.target.value)} required />
                <input style={styles.probInput} type="number" min="0.001" max="0.999" step="0.001" value={probabilities[i]} onChange={e => setProb(i, e.target.value)} required />
                <button type="button" style={styles.removeBtn} onClick={() => removeOutcome(i)} disabled={outcomes.length <= 2}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button type="button" style={styles.addBtn} onClick={addOutcome}>+ Add Outcome</button>
              <button type="button" style={{ ...styles.addBtn, background: '#f0fdf4', color: '#166534' }} onClick={normalizeAll}>Normalize</button>
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: Math.abs(probSum - 1) < 0.001 ? '#166534' : '#b45309' }}>
              Probability sum: {probSum.toFixed(4)} {Math.abs(probSum - 1) < 0.001 ? '✓' : '(click Normalize to fix)'}
            </div>

            <label style={styles.label}>Liquidity Parameter (β)</label>
            <input style={styles.input} type="number" min="0.1" step="0.1" value={beta} onChange={e => setBeta(e.target.value)} required />

            <label style={styles.label}>End Time</label>
            <input style={{ ...styles.input, boxSizing: 'border-box', maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none', minHeight: '2.6rem' }} type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required />

            <label style={styles.label}>Statement End Time — Earliest <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span></label>
            <input style={{ ...styles.input, boxSizing: 'border-box', maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none', minHeight: '2.6rem' }} type="datetime-local" value={stmtEndTimeMin} onChange={e => setStmtEndTimeMin(e.target.value)} min={endTime} />

            <label style={styles.label}>Statement End Time — Latest <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span></label>
            <input style={{ ...styles.input, boxSizing: 'border-box', maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none', minHeight: '2.6rem' }} type="datetime-local" value={stmtEndTimeMax} onChange={e => setStmtEndTimeMax(e.target.value)} min={stmtEndTimeMin || endTime} />

            <div style={canAfford ? styles.infoBox : styles.warnBox}>
              <strong>Liquidity Cost (L):</strong> {isFinite(L) ? L.toFixed(4) : '—'}<br />
              <strong>Your Balance:</strong> {user?.balance?.toFixed(4)}<br />
              {!canAfford && isFinite(L) && <span style={{ color: '#b91c1c' }}>⚠️ Insufficient balance</span>}
            </div>

            <button style={{ ...styles.submitBtn, opacity: canAfford ? 1 : 0.6 }} type="submit" disabled={loading || !canAfford}>
              {loading ? 'Creating...' : 'Create Market'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
