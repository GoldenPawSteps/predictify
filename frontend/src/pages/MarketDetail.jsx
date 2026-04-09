import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function getLocalPrices(quantities, probabilities, beta) {
  const logTerms = quantities.map((q, i) => Math.log(probabilities[i]) + q / beta);
  const maxLog = Math.max(...logTerms);
  const expTerms = logTerms.map(v => Math.exp(v - maxLog));
  const sumExp = expTerms.reduce((a, b) => a + b, 0);
  return expTerms.map(e => e / sumExp);
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  nav: { background: '#1a1a2e', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTitle: { color: '#fff', fontSize: '1.5rem', fontWeight: '700', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '1rem', alignItems: 'center' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' },
  navUser: { color: '#a5b4fc', fontSize: '0.9rem' },
  main: { maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' },
  section: { background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  h1: { fontSize: '1.4rem', fontWeight: '700', color: '#1a1a2e', marginTop: 0, marginBottom: '0.5rem' },
  h2: { fontSize: '1.1rem', fontWeight: '600', color: '#333', marginTop: 0 },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginBottom: '1rem' },
  meta: { fontSize: '0.85rem', color: '#666', marginBottom: '1rem' },
  priceBar: { marginBottom: '0.75rem' },
  priceLabelRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#333' },
  progressTrack: { height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4f46e5', borderRadius: '4px', transition: 'width 0.3s' },
  inputRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' },
  label: { flex: 1, fontSize: '0.9rem', color: '#333' },
  numInput: { width: '120px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' },
  tradeBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' },
  costBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem' },
  errorBox: { background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' },
  successBox: { background: '#f0fdf4', color: '#166534', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#555', fontWeight: '600' },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#333' },
  stmtBtn: { background: '#7c3aed', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', marginTop: '1rem' },
  resolveBtn: { background: '#059669', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', marginTop: '0.5rem', marginLeft: '0.5rem' },
  backLink: { color: '#4f46e5', textDecoration: 'none', fontSize: '0.9rem' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  stmtInput: { width: '100px', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.9rem', marginRight: '0.5rem' },
};

function statusBadge(status) {
  const bg = { active: '#dcfce7', pending_resolution: '#fef9c3', resolved: '#e0e7ff' };
  const tc = { active: '#166534', pending_resolution: '#854d0e', resolved: '#3730a3' };
  return { background: bg[status] || '#f3f4f6', color: tc[status] || '#374151' };
}

export default function MarketDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deltas, setDeltas] = useState([]);
  const [tradeError, setTradeError] = useState('');
  const [tradeSuccess, setTradeSuccess] = useState('');
  const [trading, setTrading] = useState(false);
  const [showStmtForm, setShowStmtForm] = useState(false);
  const [stmtProbs, setStmtProbs] = useState([]);
  const [stmtBeta, setStmtBeta] = useState(10);
  const [stmtEndTime, setStmtEndTime] = useState('');
  const [stmtError, setStmtError] = useState('');
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtDeltas, setStmtDeltas] = useState([]);
  const [stmtTradeError, setStmtTradeError] = useState('');
  const [stmtTradeSuccess, setStmtTradeSuccess] = useState('');
  const [stmtTrading, setStmtTrading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function fetchData() {
    try {
      const res = await api.get(`/markets/${id}`);
      setData(res.data);
      setDeltas(new Array(res.data.market.outcomes.length).fill(0));
      setStmtProbs(res.data.market.probabilities.map(() => (1 / res.data.market.outcomes.length).toFixed(4)));
      if (res.data.statement_market) {
        setStmtDeltas(new Array(res.data.market.outcomes.length).fill(0));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  function computeTradeCost(quantities, probabilities, beta, deltaQty) {
    function costFn(q, p, b) {
      const logTerms = q.map((qi, i) => Math.log(p[i]) + qi / b);
      const max = Math.max(...logTerms);
      return b * (max + Math.log(logTerms.reduce((s, v) => s + Math.exp(v - max), 0)));
    }
    const before = costFn(quantities, probabilities, beta);
    const after = costFn(quantities.map((q, i) => q + deltaQty[i]), probabilities, beta);
    const deltaC = after - before;
    const deltaMin = Math.min(...deltaQty);
    return { deltaC, deltaMin, netCost: deltaC - deltaMin };
  }

  async function handleTrade(e) {
    e.preventDefault();
    setTradeError(''); setTradeSuccess('');
    const dq = deltas.map(Number);
    setTrading(true);
    try {
      const res = await api.post(`/trades/${id}`, { delta_quantities: dq });
      setTradeSuccess(`Trade successful! Net cost: ${res.data.net_cost.toFixed(4)}`);
      await fetchData();
    } catch (err) {
      setTradeError(err.response?.data?.error || 'Trade failed');
    } finally {
      setTrading(false);
    }
  }

  async function handleCreateStatement(e) {
    e.preventDefault();
    setStmtError('');
    const probSum = stmtProbs.reduce((a, b) => a + Number(b), 0);
    const normalized = stmtProbs.map(p => Number(p) / probSum);
    setStmtLoading(true);
    try {
      await api.post(`/settlement/markets/${id}/statement`, {
        probabilities: normalized,
        liquidity_beta: Number(stmtBeta),
        end_time: new Date(stmtEndTime).toISOString(),
      });
      setShowStmtForm(false);
      await fetchData();
    } catch (err) {
      setStmtError(err.response?.data?.error || 'Failed to create statement market');
    } finally {
      setStmtLoading(false);
    }
  }

  async function handleStmtTrade(e) {
    e.preventDefault();
    setStmtTradeError(''); setStmtTradeSuccess('');
    const dq = stmtDeltas.map(Number);
    setStmtTrading(true);
    try {
      const res = await api.post(`/settlement/${data.statement_market.id}/take`, { delta_quantities: dq });
      setStmtTradeSuccess(`Trade successful! Net cost: ${res.data.net_cost.toFixed(4)}`);
      await fetchData();
    } catch (err) {
      setStmtTradeError(err.response?.data?.error || 'Trade failed');
    } finally {
      setStmtTrading(false);
    }
  }

  async function handleResolve() {
    try {
      await api.post(`/settlement/${data.statement_market.id}/resolve`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Resolution failed');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>;
  if (!data) return <div style={{ padding: '3rem', textAlign: 'center' }}>Market not found</div>;

  const { market, positions, statement_market } = data;
  const prices = market.current_prices || [];
  const isActive = market.status === 'active';
  const isExpired = new Date(market.end_time) <= new Date();
  const canTrade = isActive && !isExpired;
  const canCreateStmt = (market.status === 'active') && isExpired && !statement_market;

  const dq = deltas.map(Number);
  const tradeCostPreview = dq.some(d => d !== 0) && canTrade
    ? computeTradeCost(market.maker_quantities, market.probabilities, market.liquidity_beta, dq)
    : null;

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <Link to="/markets" style={styles.navTitle}>🎯 Predictify</Link>
        <div style={styles.navLinks}>
          <Link to="/portfolio" style={styles.navLink}>Portfolio</Link>
          <span style={styles.navUser}>💰 {user?.balance?.toFixed(2)}</span>
          <span style={styles.navUser}>{user?.username}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <div style={styles.main}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/markets" style={styles.backLink}>← Back to Markets</Link>
        </div>

        <div style={styles.section}>
          <div style={{ ...styles.badge, ...statusBadge(market.status) }}>{market.status.replace('_', ' ')}</div>
          <h1 style={styles.h1}>{market.question}</h1>
          <div style={styles.meta}>
            Created by {market.creator_username} · Ends {new Date(market.end_time).toLocaleString()} · β = {market.liquidity_beta}
          </div>
          {market.outcomes.map((outcome, i) => (
            <div key={i} style={styles.priceBar}>
              <div style={styles.priceLabelRow}>
                <span>{outcome}</span>
                <span style={{ fontWeight: '600' }}>{((prices[i] || 0) * 100).toFixed(2)}%</span>
              </div>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${((prices[i] || 0) * 100).toFixed(1)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {canTrade && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Trade</h2>
            {tradeError && <div style={styles.errorBox}>{tradeError}</div>}
            {tradeSuccess && <div style={styles.successBox}>{tradeSuccess}</div>}
            <form onSubmit={handleTrade}>
              {market.outcomes.map((o, i) => (
                <div key={i} style={styles.inputRow}>
                  <span style={styles.label}>{o}</span>
                  <input
                    style={styles.numInput}
                    type="number"
                    step="0.01"
                    value={deltas[i]}
                    onChange={e => { const d = [...deltas]; d[i] = e.target.value; setDeltas(d); }}
                  />
                </div>
              ))}
              {tradeCostPreview && (
                <div style={styles.costBox}>
                  <div>ΔC = {tradeCostPreview.deltaC.toFixed(4)}</div>
                  <div>Δ_min = {tradeCostPreview.deltaMin.toFixed(4)}</div>
                  <div><strong>Net Cost = {tradeCostPreview.netCost.toFixed(4)}</strong></div>
                </div>
              )}
              <button style={styles.tradeBtn} type="submit" disabled={trading}>{trading ? 'Trading...' : 'Submit Trade'}</button>
            </form>
          </div>
        )}

        {positions.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Positions</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>User</th>
                  {market.outcomes.map((o, i) => <th key={i} style={styles.th}>{o}</th>)}
                  <th style={styles.th}>Value (@current)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
                  const value = pos.quantities.reduce((s, q, i) => s + q * (prices[i] || 0), 0);
                  return (
                    <tr key={pos.id}>
                      <td style={styles.td}>{pos.username}</td>
                      {pos.quantities.map((q, i) => <td key={i} style={styles.td}>{q.toFixed(2)}</td>)}
                      <td style={styles.td}>{value.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canCreateStmt && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Create Statement Market</h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Market has ended. Create a statement market to begin the resolution process.</p>
            {!showStmtForm ? (
              <button style={styles.stmtBtn} onClick={() => setShowStmtForm(true)}>Create Statement Market</button>
            ) : (
              <form onSubmit={handleCreateStatement}>
                {stmtError && <div style={styles.errorBox}>{stmtError}</div>}
                <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#555' }}>Statement Probabilities (your belief about true outcome):</div>
                {market.outcomes.map((o, i) => (
                  <div key={i} style={styles.inputRow}>
                    <span style={styles.label}>{o}</span>
                    <input
                      style={styles.stmtInput}
                      type="number" min="0.001" max="0.999" step="0.001"
                      value={stmtProbs[i]}
                      onChange={e => { const p = [...stmtProbs]; p[i] = e.target.value; setStmtProbs(p); }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ ...styles.label, display: 'inline' }}>Beta: </label>
                  <input style={{ ...styles.stmtInput, width: '80px' }} type="number" min="0.1" step="0.1" value={stmtBeta} onChange={e => setStmtBeta(e.target.value)} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ ...styles.label, display: 'inline' }}>End Time: </label>
                  <input style={styles.stmtInput} type="datetime-local" value={stmtEndTime} onChange={e => setStmtEndTime(e.target.value)} required />
                </div>
                <button style={styles.stmtBtn} type="submit" disabled={stmtLoading}>{stmtLoading ? 'Creating...' : 'Submit Statement'}</button>
                <button type="button" style={{ ...styles.stmtBtn, background: '#6b7280', marginLeft: '0.5rem' }} onClick={() => setShowStmtForm(false)}>Cancel</button>
              </form>
            )}
          </div>
        )}

        {statement_market && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Statement Market</h2>
            <div style={{ ...styles.badge, ...statusBadge(statement_market.status) }}>{statement_market.status}</div>
            <div style={styles.meta}>
              Ends {new Date(statement_market.end_time).toLocaleString()} · β = {statement_market.liquidity_beta}
            </div>
            {market.outcomes.map((o, i) => {
              const sp = getLocalPrices(statement_market.maker_quantities, statement_market.probabilities, statement_market.liquidity_beta);
              return (
                <div key={i} style={styles.priceBar}>
                  <div style={styles.priceLabelRow}>
                    <span>{o}</span>
                    <span>{((sp[i] || 0) * 100).toFixed(2)}%</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: `${((sp[i] || 0) * 100).toFixed(1)}%`, background: '#7c3aed' }} />
                  </div>
                </div>
              );
            })}

            {statement_market.status === 'active' && new Date(statement_market.end_time) > new Date() && (
              <div style={{ marginTop: '1rem' }}>
                <h2 style={styles.h2}>Trade Statement Market</h2>
                {stmtTradeError && <div style={styles.errorBox}>{stmtTradeError}</div>}
                {stmtTradeSuccess && <div style={styles.successBox}>{stmtTradeSuccess}</div>}
                <form onSubmit={handleStmtTrade}>
                  {market.outcomes.map((o, i) => (
                    <div key={i} style={styles.inputRow}>
                      <span style={styles.label}>{o}</span>
                      <input
                        style={styles.numInput}
                        type="number" step="0.01"
                        value={stmtDeltas[i] || 0}
                        onChange={e => { const d = [...stmtDeltas]; d[i] = e.target.value; setStmtDeltas(d); }}
                      />
                    </div>
                  ))}
                  <button style={{ ...styles.tradeBtn, background: '#7c3aed' }} type="submit" disabled={stmtTrading}>{stmtTrading ? 'Trading...' : 'Submit Trade'}</button>
                </form>
              </div>
            )}

            {statement_market.status === 'active' && new Date(statement_market.end_time) <= new Date() && (
              <button style={styles.resolveBtn} onClick={handleResolve}>Resolve Statement Market</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
