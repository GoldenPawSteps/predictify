import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const styles = {
  container: { minHeight: '100vh', background: 'var(--page-bg)' },
  nav: { background: '#1a1a2e', padding: '0.75rem 1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  navTitle: { color: '#fff', fontSize: '1.5rem', fontWeight: '700', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' },
  navUser: { color: '#a5b4fc', fontSize: '0.9rem' },
  main: { maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' },
  section: { background: 'var(--surface)', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', marginBottom: '1.5rem' },
  h1: { fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: 0 },
  h2: { fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '0.75rem' },
  balanceBox: { background: 'var(--balance-bg)', border: '1px solid var(--balance-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  balanceAmount: { fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  tableWrapper: { overflowX: 'auto', overflowY: 'auto', maxHeight: '300px' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: '600' },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' },
  posLink: { color: 'var(--link)', textDecoration: 'none', fontWeight: '500' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  themeBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
  empty: { color: 'var(--text-faint)', textAlign: 'center', padding: '2rem', fontSize: '0.95rem' },
  ledgerPos: { color: '#166534' },
  ledgerNeg: { color: '#b91c1c' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' },
  ctrlRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' },
  ctrlLabel: { fontSize: '0.75rem', color: 'var(--text-faint2)', fontWeight: 600 },
  pill: (active, color) => ({ background: active ? color : 'var(--pill-bg)', color: active ? '#fff' : 'var(--pill-text)', border: '1px solid ' + (active ? color : 'var(--pill-border)'), borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }),
  searchInput: { width: '100%', padding: '0.45rem 0.75rem', border: '1px solid var(--border-input2)', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '0.6rem', background: 'var(--surface)', color: 'var(--text-primary)' },
  tabBar: { display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' },
  tab: (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid var(--text-primary)' : '2px solid transparent', marginBottom: '-2px', padding: '0.65rem 1.2rem', fontWeight: 600, fontSize: '0.95rem', color: active ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }),
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
  const { dark, mode, toggleTheme } = useTheme();
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

  const [searchParams, setSearchParams] = useSearchParams();

  // --- My Markets controls ---
  const mktSearch = searchParams.get('mQ') || '';
  const mktStatus = searchParams.get('mStatus') || null;
  const mktType = searchParams.get('mType') || null;
  const mktSort = searchParams.get('mSort') || 'newest';

  // --- Open Positions controls ---
  const posSearch = searchParams.get('pQ') || '';
  const posStatus = searchParams.get('pStatus') || null;
  const posType = searchParams.get('pType') || null;
  const posSort = searchParams.get('pSort') || 'recent';

  // --- Ledger controls ---
  const ledgerSearch = searchParams.get('lQ') || '';
  const ledgerDir = searchParams.get('lDir') || null;
  const ledgerSort = searchParams.get('lSort') || 'newest';
  const activeTab = searchParams.get('tab') || 'markets';

  function setParam(key, value, defaultValue) {
    setSearchParams(p => {
      const n = new URLSearchParams(p);
      if (value == null || value === defaultValue) n.delete(key); else n.set(key, value);
      return n;
    }, { replace: key === 'tab' });
  }

  function handleLogout() { logout(); navigate('/login'); }

  const allMyMarketRows = [
    ...markets.filter(m => m.creator_id === user?.id).map(m => ({ ...m, _type: 'market', _sortKey: m.created_at })),
    ...stmtMarkets.map(sm => ({ ...sm, _type: 'statement', _sortKey: sm.created_at })),
  ];

  const myMarketRows = allMyMarketRows
    .filter(row => {
      const label = row._type === 'market' ? row.question : row.original_question;
      if (mktSearch && !label.toLowerCase().includes(mktSearch.toLowerCase())) return false;
      if (mktType && row._type !== mktType) return false;
      if (mktStatus) {
        const s = displayStatus(row.status, row.end_time);
        if (s !== mktStatus) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (mktSort === 'newest') return new Date(b._sortKey) - new Date(a._sortKey);
      if (mktSort === 'oldest') return new Date(a._sortKey) - new Date(b._sortKey);
      if (mktSort === 'ending_soon') return new Date(a.end_time) - new Date(b.end_time);
      if (mktSort === 'volume') return (b.volume || 0) - (a.volume || 0);
      return 0;
    });

  const allOpenPositionRows = [
    ...positions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).map(p => ({ ...p, _type: 'market', _sortKey: p.updated_at, _link: `/markets/${p.market_id}` })),
    ...stmtPositions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).map(p => ({ ...p, _type: 'statement', _sortKey: p.updated_at, _link: `/markets/${p.original_market_id}` })),
  ];

  const openPositionRows = allOpenPositionRows
    .filter(p => {
      if (posSearch && !p.question.toLowerCase().includes(posSearch.toLowerCase())) return false;
      if (posType && p._type !== posType) return false;
      if (posStatus) {
        const s = displayStatus(p.status, p.end_time);
        if (s !== posStatus) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (posSort === 'recent') return new Date(b._sortKey) - new Date(a._sortKey);
      if (posSort === 'oldest') return new Date(a._sortKey) - new Date(b._sortKey);
      if (posSort === 'ending_soon') return new Date(a.end_time) - new Date(b.end_time);
      return 0;
    });

  const filteredLedger = ledger
    .filter(entry => {
      if (ledgerSearch) {
        const q = ledgerSearch.toLowerCase();
        if (!entry.description.toLowerCase().includes(q) && !(entry.market_question || '').toLowerCase().includes(q)) return false;
      }
      if (ledgerDir === 'credit' && entry.amount < 0) return false;
      if (ledgerDir === 'debit' && entry.amount >= 0) return false;
      return true;
    })
    .sort((a, b) => ledgerSort === 'oldest'
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at)
    );

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <Link to="/markets" style={styles.navTitle}>🎯 Predictify</Link>
        <div style={styles.navLinks}>
          <Link to="/markets" style={styles.navLink}>Markets</Link>
          <span style={styles.navUser}>{user?.username}</span>
          <button style={styles.themeBtn} onClick={toggleTheme} title={mode === 'auto' ? 'Auto (system)' : mode === 'light' ? 'Light' : 'Dark'}>{mode === 'auto' ? '💻' : mode === 'light' ? '☀️' : '🌙'}</button>
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

        <div style={styles.tabBar}>
          {[['markets','My Markets'],['positions','Open Positions'],['ledger','Transaction History']].map(([k,l]) => (
            <button key={k} style={styles.tab(activeTab===k)} onClick={() => setParam('tab', k, 'markets')}>{l}</button>
          ))}
        </div>

        {activeTab === 'markets' && (
          <div style={styles.section}>
            {allMyMarketRows.length === 0 ? (
              <div style={styles.empty}>You haven't created any markets yet. <Link to="/markets/new">Create one!</Link></div>
            ) : (
              <>
                <input type="search" placeholder="Search..." value={mktSearch} onChange={e => setParam('mQ', e.target.value || null, null)} style={styles.searchInput} />
                <div style={styles.ctrlRow}>
                  <span style={styles.ctrlLabel}>Sort:</span>
                  {[['newest','Newest'],['oldest','Oldest'],['ending_soon','Ending Soon'],['volume','Volume']].map(([k,l]) => <button key={k} style={styles.pill(mktSort===k,'#1a1a2e')} onClick={() => setParam('mSort', k, 'newest')}>{l}</button>)}
                </div>
                <div style={styles.ctrlRow}>
                  <span style={styles.ctrlLabel}>Type:</span>
                  {[[null,'All'],['market','Market'],['statement','Statement']].map(([k,l]) => <button key={k??'all'} style={styles.pill(mktType===k,'#7c3aed')} onClick={() => setParam('mType', mktType===k?null:k, null)}>{l}</button>)}
                  <span style={{ ...styles.ctrlLabel, marginLeft: '0.5rem' }}>Status:</span>
                  {[[null,'All'],['active','Active'],['expired','Expired'],['pending_resolution','Pending'],['resolved','Resolved']].map(([k,l]) => <button key={k??'all'} style={styles.pill(mktStatus===k,'#1a1a2e')} onClick={() => setParam('mStatus', mktStatus===k?null:k, null)}>{l}</button>)}
                </div>
                <div style={styles.tableWrapper}>
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
                    {myMarketRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No results</td></tr>
                    ) : myMarketRows.map(row => row._type === 'market' ? (
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
              </>
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <div style={styles.section}>
            {allOpenPositionRows.length === 0 ? (
              <div style={styles.empty}>
                No open positions. <Link to="/markets" style={{ color: '#4f46e5' }}>Browse Markets →</Link>
              </div>
            ) : (
              <>
                <input type="search" placeholder="Search..." value={posSearch} onChange={e => setParam('pQ', e.target.value || null, null)} style={styles.searchInput} />
                <div style={styles.ctrlRow}>
                  <span style={styles.ctrlLabel}>Sort:</span>
                  {[['recent','Recent'],['oldest','Oldest'],['ending_soon','Ending Soon']].map(([k,l]) => <button key={k} style={styles.pill(posSort===k,'#1a1a2e')} onClick={() => setParam('pSort', k, 'recent')}>{l}</button>)}
                </div>
                <div style={styles.ctrlRow}>
                  <span style={styles.ctrlLabel}>Type:</span>
                  {[[null,'All'],['market','Market'],['statement','Statement']].map(([k,l]) => <button key={k??'all'} style={styles.pill(posType===k,'#7c3aed')} onClick={() => setParam('pType', posType===k?null:k, null)}>{l}</button>)}
                  <span style={{ ...styles.ctrlLabel, marginLeft: '0.5rem' }}>Status:</span>
                  {[[null,'All'],['active','Active'],['expired','Expired'],['pending_resolution','Pending']].map(([k,l]) => <button key={k??'all'} style={styles.pill(posStatus===k,'#1a1a2e')} onClick={() => setParam('pStatus', posStatus===k?null:k, null)}>{l}</button>)}
                </div>
                <div style={styles.tableWrapper}>
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
                    {openPositionRows.length === 0 ? (
                      <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No results</td></tr>
                    ) : openPositionRows.map(p => (
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
              </>
            )}
          </div>
        )}

        {activeTab === 'ledger' && (
          <div style={styles.section}>
            {ledger.length === 0 ? (
              <div style={styles.empty}>No transactions yet.</div>
            ) : (
              <>
                <input type="search" placeholder="Search..." value={ledgerSearch} onChange={e => setParam('lQ', e.target.value || null, null)} style={styles.searchInput} />
                <div style={styles.ctrlRow}>
                  <span style={styles.ctrlLabel}>Sort:</span>
                  {[['newest','Newest'],['oldest','Oldest']].map(([k,l]) => <button key={k} style={styles.pill(ledgerSort===k,'#1a1a2e')} onClick={() => setParam('lSort', k, 'newest')}>{l}</button>)}
                  <span style={{ ...styles.ctrlLabel, marginLeft: '0.5rem' }}>Direction:</span>
                  {[[null,'All'],['credit','Credits'],['debit','Debits']].map(([k,l]) => <button key={k??'all'} style={styles.pill(ledgerDir===k,'#059669')} onClick={() => setParam('lDir', ledgerDir===k?null:k, null)}>{l}</button>)}
                </div>
                <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Date</th>
                      <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Description</th>
                      <th style={{ ...styles.th, position: 'sticky', top: 0, background: '#fff' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.length === 0 ? (
                      <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No results</td></tr>
                    ) : filteredLedger.map(entry => (
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
