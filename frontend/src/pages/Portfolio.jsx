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
};

export default function Portfolio() {
  const [markets, setMarkets] = useState([]);
  const [positions, setPositions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [, mRes, lRes, pRes] = await Promise.all([
          refreshUser(),
          api.get('/markets'),
          api.get('/portfolio/ledger').catch(() => ({ data: { ledger: [] } })),
          api.get('/portfolio/positions').catch(() => ({ data: { positions: [] } })),
        ]);
        setMarkets(mRes.data.markets);
        setLedger(lRes.data.ledger || []);
        setPositions(pRes.data.positions || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

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
          {markets.filter(m => m.creator_id === user?.id).length === 0 ? (
            <div style={styles.empty}>You haven't created any markets yet. <Link to="/markets/new">Create one!</Link></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Question</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>L Cost</th>
                    <th style={styles.th}>Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.filter(m => m.creator_id === user?.id).map(m => (
                    <tr key={m.id}>
                      <td style={styles.td}><Link to={`/markets/${m.id}`} style={styles.posLink}>{m.question}</Link></td>
                      <td style={styles.td}>{m.status}</td>
                      <td style={styles.td}>{m.liquidity_cost?.toFixed(2)}</td>
                      <td style={styles.td}>{new Date(m.end_time).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>Open Positions</h2>
          {positions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).length === 0 ? (
            <div style={styles.empty}>
              No open positions. <Link to="/markets" style={{ color: '#4f46e5' }}>Browse Markets →</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Market</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Quantities</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.filter(p => p.status !== 'resolved' && p.quantities.some(q => q !== 0)).map(p => (
                    <tr key={p.market_id}>
                      <td style={styles.td}><Link to={`/markets/${p.market_id}`} style={styles.posLink}>{p.question}</Link></td>
                      <td style={styles.td}>{p.status}</td>
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
            <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Amount</th>
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
