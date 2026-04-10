import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const CHART_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#16a34a'];

function formatHistory(history, outcomes) {
  return history.map((h) => {
    const pt = { t: new Date(h.created_at).getTime() };
    outcomes.forEach((o, i) => { pt[o] = +(h.prices[i] * 100).toFixed(1); });
    return pt;
  });
}

function formatChartTime(ms, history) {
  if (!history || history.length < 2) return '';
  const span = history[history.length - 1].t - history[0].t;
  const d = new Date(ms);
  if (span < 60 * 60 * 1000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (span < 24 * 60 * 60 * 1000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function getLocalPrices(quantities, probabilities, beta) {
  const logTerms = quantities.map((q, i) => Math.log(probabilities[i]) + q / beta);
  const maxLog = Math.max(...logTerms);
  const expTerms = logTerms.map(v => Math.exp(v - maxLog));
  const sumExp = expTerms.reduce((a, b) => a + b, 0);
  return expTerms.map(e => e / sumExp);
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  nav: { background: '#1a1a2e', padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  navTitle: { color: '#fff', fontSize: '1.5rem', fontWeight: '700', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
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
  numInput: { width: '120px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' },
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
  stmtInput: { width: '100px', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem', marginRight: '0.5rem' },
  tabBar: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' },
  tab: (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid #1a1a2e' : '2px solid transparent', marginBottom: '-2px', padding: '0.65rem 1.2rem', fontWeight: 600, fontSize: '0.95rem', color: active ? '#1a1a2e' : '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }),
};

function statusBadge(status) {
  const bg = { active: '#dcfce7', pending_resolution: '#fef9c3', resolved: '#e0e7ff' };
  const tc = { active: '#166534', pending_resolution: '#854d0e', resolved: '#3730a3' };
  return { background: bg[status] || '#f3f4f6', color: tc[status] || '#374151' };
}

const expiredBadge = { background: '#fee2e2', color: '#b91c1c' };

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'market';
  function setActiveTab(tab) {
    setSearchParams(p => { const n = new URLSearchParams(p); tab === 'market' ? n.delete('tab') : n.set('tab', tab); return n; }, { replace: true });
  }
  const [chartReady, setChartReady] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [stmtPriceHistory, setStmtPriceHistory] = useState([]);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  async function fetchData() {
    try {
      const [res, histRes] = await Promise.all([
        api.get(`/markets/${id}`),
        api.get(`/markets/${id}/price-history`).catch(() => ({ data: { history: [] } }))
      ]);
      setData(res.data);
      setDeltas(new Array(res.data.market.outcomes.length).fill(0));
      setStmtProbs(res.data.market.probabilities.map(() => (1 / res.data.market.outcomes.length).toFixed(4)));
      setPriceHistory(histRes.data.history || []);
      if (res.data.statement_market) {
        setStmtDeltas(new Array(res.data.market.outcomes.length).fill(0));
        const stmtHistRes = await api.get(`/settlement/${res.data.statement_market.id}/price-history`).catch(() => ({ data: { history: [] } }));
        setStmtPriceHistory(stmtHistRes.data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); refreshUser(); }, [id]);
  useEffect(() => {
    setChartReady(false);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // On desktop there is no ghost touch — enable immediately.
    if (!isTouchDevice) setChartReady(true);
    // On touch devices: do NOT listen on document. onTouchEnd on the chart
    // divs themselves handles enabling (see JSX below).
  }, [id]);

  function enableChart() {
    if (!chartReady)
      setTimeout(() => setChartReady(true), 100);
  }

  // Overlay touch handlers: only unlock chart for a tap, not a scroll.
  // iOS fires synthetic mousemove after scroll gestures too, so we must
  // keep the overlay in place whenever the touch involved significant movement.
  const overlayTouchRef = useRef({ startX: 0, startY: 0, moved: false });
  const chartWrapperRef = useRef(null);
  const stmtChartWrapperRef = useRef(null);

  // When chart is active, re-lock it whenever the user touches outside it.
  useEffect(() => {
    if (!chartReady) return;
    const onOutsideTouch = (e) => {
      const inMain = chartWrapperRef.current && chartWrapperRef.current.contains(e.target);
      const inStmt = stmtChartWrapperRef.current && stmtChartWrapperRef.current.contains(e.target);
      if (!inMain && !inStmt) setChartReady(false);
    };
    document.addEventListener('touchstart', onOutsideTouch, { passive: true });
    return () => document.removeEventListener('touchstart', onOutsideTouch);
  }, [chartReady]);
  function onOverlayTouchStart(e) {
    const t = e.changedTouches[0];
    overlayTouchRef.current = { startX: t.clientX, startY: t.clientY, moved: false };
  }
  function onOverlayTouchMove(e) {
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - overlayTouchRef.current.startX);
    const dy = Math.abs(t.clientY - overlayTouchRef.current.startY);
    if (dx > 8 || dy > 8) overlayTouchRef.current.moved = true;
  }
  function onOverlayTouchEnd() {
    if (!overlayTouchRef.current.moved) enableChart();
    // If it was a scroll, keep overlay — do nothing.
  }

  function computeTradeCost(quantities, probabilities, beta, deltaQty, currentTakerQty) {
    function costFn(q, p, b) {
      const logTerms = q.map((qi, i) => Math.log(p[i]) + qi / b);
      const max = Math.max(...logTerms);
      return b * (max + Math.log(logTerms.reduce((s, v) => s + Math.exp(v - max), 0)));
    }
    const before = costFn(quantities, probabilities, beta);
    const after = costFn(quantities.map((q, i) => q + deltaQty[i]), probabilities, beta);
    const deltaC = after - before;
    // Δ_min = min(q'^t) - min(q^t) where q'^t = q^t + Δq
    const curQty = currentTakerQty || new Array(deltaQty.length).fill(0);
    const qPrimeT = curQty.map((q, i) => q + deltaQty[i]);
    const deltaMin = Math.min(...qPrimeT) - Math.min(...curQty);
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
      await refreshUser();
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
      await refreshUser();
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
      await refreshUser();
    } catch (err) {
      alert(err.response?.data?.error || 'Resolution failed');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>;
  if (!data) return <div style={{ padding: '3rem', textAlign: 'center' }}>Market not found</div>;

  const { market, positions, statement_market, statement_positions } = data;
  const prices = market.current_prices || [];
  const isActive = market.status === 'active';
  const isExpired = new Date(market.end_time) <= new Date();
  const canTrade = isActive && !isExpired;
  const canCreateStmt = (market.status === 'active') && isExpired && !statement_market;

  const dq = deltas.map(Number);
  const myPosition = positions?.find(p => p.user_id === user?.id);
  const myQty = myPosition ? myPosition.quantities : null;
  const tradeCostPreview = dq.some(d => d !== 0) && canTrade
    ? computeTradeCost(market.maker_quantities, market.probabilities, market.liquidity_beta, dq, myQty)
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
          <span style={{ ...styles.backLink, cursor: 'pointer' }} onClick={() => navigate(-1)}>← Back</span>
        </div>

        {isExpired && (
          <div style={styles.tabBar}>
            <button style={styles.tab(activeTab === 'market')} onClick={() => setActiveTab('market')}>Market</button>
            <button style={styles.tab(activeTab === 'statement')} onClick={() => setActiveTab('statement')}>Statement</button>
          </div>
        )}

        {(!isExpired || activeTab === 'market') && (<>

        <div style={styles.section}>
          {(() => { const exp = isExpired && market.status === 'active'; return <div style={{ ...styles.badge, ...(exp ? expiredBadge : statusBadge(market.status)) }}>{exp ? 'expired' : market.status.replace(/_/g, ' ')}</div>; })()}
          <h1 style={styles.h1}>{market.question}</h1>
          {market.description && <p style={{ color: '#555', fontSize: '0.95rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{market.description}</p>}
          {market.tags && market.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {market.tags.map(t => <span key={t} style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}>{t}</span>)}
            </div>
          )}
          <div style={styles.meta}>
            Created by {market.creator_username} · Ends {new Date(market.end_time).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} {new Date(market.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · β = {market.liquidity_beta} · Vol {(market.volume || 0).toFixed(2)}
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
          {priceHistory.length >= 1 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: '#555', margin: '0 0 0.5rem' }}>Price History</h3>
              <div ref={chartWrapperRef} style={{ position: 'relative', height: 180 }}>
                <div style={{ pointerEvents: chartReady ? 'auto' : 'none', height: 180 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={formatHistory(priceHistory, market.outcomes)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10 }} tickFormatter={(ms) => formatChartTime(ms, formatHistory(priceHistory, market.outcomes))} minTickGap={40} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      {chartReady && <Tooltip labelFormatter={(ms) => new Date(ms).toLocaleString()} formatter={(v) => `${v}%`} />}
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '0.8rem' }} />
                      {market.outcomes.map((o, i) => (
                        <Line key={o} type="monotone" dataKey={o} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {!chartReady && <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} onTouchStart={onOverlayTouchStart} onTouchMove={onOverlayTouchMove} onTouchEnd={onOverlayTouchEnd} />}
              </div>
            </div>
          )}
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
            <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>User</th>
                  {market.outcomes.map((o, i) => <th key={i} style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>{o}</th>)}
                  <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Value (@current)</th>
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
          </div>
        )}

        </>)}

        {isExpired && activeTab === 'statement' && (<>

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
            {(() => { const exp = statement_market.status === 'active' && new Date(statement_market.end_time) <= new Date(); return <div style={{ ...styles.badge, ...(exp ? expiredBadge : statusBadge(statement_market.status)) }}>{exp ? 'expired' : statement_market.status.replace(/_/g, ' ')}</div>; })()}
            <div style={styles.meta}>
              Created by {statement_market.creator_username} · Ends {new Date(statement_market.end_time).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} {new Date(statement_market.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · β = {statement_market.liquidity_beta} · Vol {(statement_market.volume || 0).toFixed(2)}
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
          {stmtPriceHistory.length >= 1 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: '#555', margin: '0 0 0.5rem' }}>Statement Price History</h3>
              <div ref={stmtChartWrapperRef} style={{ position: 'relative', height: 180 }}>
                <div style={{ pointerEvents: chartReady ? 'auto' : 'none', height: 180 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={formatHistory(stmtPriceHistory, market.outcomes)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={{ fontSize: 10 }} tickFormatter={(ms) => formatChartTime(ms, formatHistory(stmtPriceHistory, market.outcomes))} minTickGap={40} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      {chartReady && <Tooltip labelFormatter={(ms) => new Date(ms).toLocaleString()} formatter={(v) => `${v}%`} />}
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '0.8rem' }} />
                      {market.outcomes.map((o, i) => (
                        <Line key={o} type="monotone" dataKey={o} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {!chartReady && <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} onTouchStart={onOverlayTouchStart} onTouchMove={onOverlayTouchMove} onTouchEnd={onOverlayTouchEnd} />}
              </div>
            </div>
          )}

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
                        value={stmtDeltas[i]}
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

            {statement_positions && statement_positions.length > 0 && (() => {
              const sp = getLocalPrices(statement_market.maker_quantities, statement_market.probabilities, statement_market.liquidity_beta);
              return (
                <div style={{ marginTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#555', margin: '0 0 0.5rem' }}>Statement Positions</h3>
                  <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>User</th>
                        {market.outcomes.map((o, i) => <th key={i} style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>{o}</th>)}
                        <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Value (@current)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement_positions.map(pos => {
                        const value = pos.quantities.reduce((s, q, i) => s + q * (sp[i] || 0), 0);
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
                </div>
              );
            })()}
          </div>
        )}

        </>)}
      </div>
    </div>
  );
}
