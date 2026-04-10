import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  nav: { background: '#1a1a2e', padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  navTitle: { color: '#fff', fontSize: '1.5rem', fontWeight: '700', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' },
  navUser: { color: '#a5b4fc', fontSize: '0.9rem' },
  main: { maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' },
  section: { background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  h1: { fontSize: '1.5rem', fontWeight: '700', color: '#1a1a2e', marginTop: 0 },
  h2: { fontSize: '1.1rem', fontWeight: '600', color: '#333', marginTop: 0 },
  balanceBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  balanceAmount: { fontSize: '2rem', fontWeight: '700', color: '#1a1a2e' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#555', fontWeight: '600' },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#333' },
  posLink: { color: '#4f46e5', textDecoration: 'none', fontWeight: '500' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  empty: { color: '#888', textAlign: 'center', padding: '2rem', fontSize: '0.95rem' },
  ledgerPos: { color: '#166534' },
  ledgerNeg: { color: '#b91c1c' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' },
};

function statusBadge(status) {
  const bg = { active: '#dcfce7', pending_resolution: '#fef9c3', resolved: '#e0e7ff', expired: '#fee2e2' };
  const tc = { active: '#166534', pending_resolution: '#854d0e', resolved: '#3730a3', expired: '#b91c1c' };
  return { background: bg[status] || '#f3f4f6', color: tc[status] || '#374151' };
}

function displayStatus(status, endTime) {
  return status === 'active' && new Date(endTime) <= new Date() ? 'expired' : status;
}

export default function Portfolio() {
  const [markets, setMarkets] = useState([]);
  const [positions, setPositions] = useState([]);
  const [stmtMarkets, setStmtMarkets] = useState([]);
  const [stmtPositions, setStmtPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [, mRes, lRes, pRes, smRes, spRes] = await Promise.all([
          refreshUser(),
          api.get('/markets'),
          api.get('/portfolio/ledger').catch(() => ({ data: { ledger: [] } })),
          api.get('/portfolio/positions').catch(() => ({ data: { positions: [] } })),
          api.get('/portfolio/statement-markets').catch(() => ({ data: { statement_markets: [] } })),
          api.get('/portfolio/statement-positions').catch(() => ({ data: { positions: [] } })),
        ]);
        setMarkets(mRes.data.markets);
        setLedger(lRes.data.ledger || []);
        setPositions(pRes.data.positions || []);
        setStmtMarkets(smRes.data.statement_markets || []);
        setStmtPositions(spRes.data.positions || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  const myMarketRows = [
    ...markets.filter(m => m.creator_id === user?.id).map(m => ({ ...m, _type: 'market', _sortKey: m.created_at })),
    ...stmtMarkets.map(sm => ({ ...sm, _type: 'statement', _sortKey: sm.created_at })),
  ].sort((a, b) => new Date(b._sortKey) - new Date(a._sortKey));

  const openPositionRows = [
    ...positions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).map(p => ({ ...p, _type: 'market', _sortKey: p.updated_at, _link: `/markets/${p.market_id}` })),
    ...stmtPositions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).map(p => ({ ...p, _type: 'statement', _sortKey: p.updated_at, _link: `/markets/${p.original_market_id}` })),
  ].sort((a, b) => new Date(b._sortKey) - new Date(a._sortKey));

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <Link to="/markets" style={styles.navTitle}>🎯 Predictify</Link>
        <div style={styles.navLinks}>
          <Link to="/markets" style={styles.navLink}>Markets</Link>
          <span style={styles.navUser}>{user?.username}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <div style={styles.main}>
        <h1 style={styles.h1}>Portfolio</h1>
        <div style={styles.balanceBox}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Current Balance</div>
            <div style={styles.balanceAmount}>💰 {user?.balance?.toFixed(4)}</div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>My Markets</h2>
          {myMarketRows.length === 0 ? (
            <div style={styles.empty}>You haven't created any markets yet. <Link to="/markets/new">Create one!</Link></div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Question</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Type</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Status</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>L Cost</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Vol</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {myMarketRows.map(row => row._type === 'market' ? (
                    <tr key={row.id}>
                      <td style={styles.td}><Link to={`/markets/${row.id}`} style={styles.posLink}>{row.question}</Link></td>
                      <td style={styles.td}><span style={{ fontSize: '0.8rem', color: '#555' }}>market</span></td>
                      <td style={styles.td}>{(() => { const s = displayStatus(row.status, row.end_time); return <span style={{ ...styles.badge, ...statusBadge(s) }}>{s.replace(/_/g, ' ')}</span>; })()}</td>
                      <td style={styles.td}>{row.liquidity_cost?.toFixed(2)}</td>
                      <td style={styles.td}>{(row.volume || 0).toFixed(2)}</td>
                      <td style={styles.td}>{new Date(row.end_time).toLocaleDateString()}</td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td style={styles.td}><Link to={`/markets/${row.original_market_id}`} style={styles.posLink}>{row.original_question}</Link></td>
                      <td style={styles.td}><span style={{ fontSize: '0.8rem', color: '#7c3aed' }}>statement</span></td>
                      <td style={styles.td}>{(() => { const s = displayStatus(row.status, row.end_time); return <span style={{ ...styles.badge, ...statusBadge(s) }}>{s.replace(/_/g, ' ')}</span>; })()}</td>
                      <td style={styles.td}>{row.liquidity_cost?.toFixed(2)}</td>
                      <td style={styles.td}>{(row.volume || 0).toFixed(2)}</td>
                      <td style={styles.td}>{new Date(row.end_time).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>Open Positions</h2>
          {openPositionRows.length === 0 ? (
            <div style={styles.empty}>
              No open positions. <Link to="/markets" style={{ color: '#4f46e5' }}>Browse Markets →</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Market</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Type</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Status</th>
                    <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Quantities</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositionRows.map(p => (
                    <tr key={p._type === 'market' ? p.market_id : p.statement_market_id}>
                      <td style={styles.td}><Link to={p._link} style={styles.posLink}>{p.question}</Link></td>
                      <td style={styles.td}><span style={{ fontSize: '0.8rem', color: p._type === 'statement' ? '#7c3aed' : '#555' }}>{p._type}</span></td>
                      <td style={styles.td}>{(() => { const s = displayStatus(p.status, p.end_time); return <span style={{ ...styles.badge, ...statusBadge(s) }}>{s.replace(/_/g, ' ')}</span>; })()}</td>
                      <td style={styles.td}>
                        {p.outcomes.map((o, i) => (
                          <div key={i} style={{ fontSize: '0.85rem' }}>{o}: {Number(p.quantities[i]).toFixed(2)}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {ledger.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.h2}>Transaction History</h2>
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Date</th>
                  <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Description</th>
                  <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(entry => (
                  <tr key={entry.id}>
                    <td style={styles.td}>{new Date(entry.created_at).toLocaleString()}</td>
                    <td style={styles.td}>
                      {entry.description}
                      {entry.market_id && entry.market_question && (
                        <> · <Link to={`/markets/${entry.market_id}`} style={styles.posLink}>{entry.market_question}</Link></>
                      )}
                    </td>
                    <td style={{ ...styles.td, ...(entry.amount >= 0 ? styles.ledgerPos : styles.ledgerNeg) }}>
                      {entry.amount >= 0 ? '+' : ''}{entry.amount.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
