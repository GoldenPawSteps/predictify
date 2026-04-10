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
  main: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  h1: { fontSize: '1.75rem', fontWeight: '700', color: '#1a1a2e', margin: 0 },
  createBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', textDecoration: 'none', fontSize: '0.95rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  card: { background: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'box-shadow 0.2s', display: 'block', textDecoration: 'none', color: 'inherit' },
  cardTitle: { fontSize: '1.1rem', fontWeight: '600', color: '#1a1a2e', marginBottom: '0.5rem' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.75rem' },
  priceBar: { marginBottom: '0.5rem' },
  priceLabelRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.85rem', color: '#555' },
  progressTrack: { height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4f46e5', borderRadius: '3px' },
  meta: { marginTop: '0.75rem', fontSize: '0.8rem', color: '#888' },
  empty: { textAlign: 'center', padding: '4rem', color: '#888' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
};

function statusBadge(status) {
  const colors = { active: '#dcfce7', pending_resolution: '#fef9c3', resolved: '#e0e7ff' };
  const textColors = { active: '#166534', pending_resolution: '#854d0e', resolved: '#3730a3' };
  return { background: colors[status] || '#f3f4f6', color: textColors[status] || '#374151' };
}

const expiredBadge = { background: '#fee2e2', color: '#b91c1c' };

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refreshUser();
    api.get('/markets').then(res => setMarkets(res.data.markets)).finally(() => setLoading(false));
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  const allTags = [...new Set(markets.flatMap(m => m.tags || []))].sort();
  const filteredMarkets = activeTag ? markets.filter(m => (m.tags || []).includes(activeTag)) : markets;

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
        <div style={styles.header}>
          <h1 style={styles.h1}>Prediction Markets</h1>
          <Link to="/markets/new" style={styles.createBtn}>+ Create Market</Link>
        </div>
        {!loading && allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[null, ...allTags].map(t => (
              <button key={t ?? '__all__'} onClick={() => setActiveTag(activeTag === t ? null : t)} style={{ background: t === activeTag ? '#4f46e5' : '#fff', color: t === activeTag ? '#fff' : '#374151', border: '1px solid ' + (t === activeTag ? '#4f46e5' : '#d1d5db'), borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                {t === null ? 'All' : t}
              </button>
            ))}
          </div>
        )}
        {loading ? <div style={styles.empty}>Loading markets...</div> : markets.length === 0 ? (
          <div style={styles.empty}>
            <p>No markets yet.</p>
            <Link to="/markets/new" style={styles.createBtn}>Create the first market</Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredMarkets.map(m => (
              <Link key={m.id} to={`/markets/${m.id}`} style={styles.card}>
                {(() => { const exp = m.status === 'active' && new Date(m.end_time) <= new Date(); return <div style={{ ...styles.badge, ...(exp ? expiredBadge : statusBadge(m.status)) }}>{exp ? 'expired' : m.status.replace(/_/g, ' ')}</div>; })()}
                <div style={styles.cardTitle}>{m.question}</div>
                {m.outcomes.map((outcome, i) => (
                  <div key={i} style={styles.priceBar}>
                    <div style={styles.priceLabelRow}>
                      <span>{outcome}</span>
                      <span>{((m.current_prices?.[i] || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${((m.current_prices?.[i] || 0) * 100).toFixed(1)}%` }} />
                    </div>
                  </div>
                ))}
                <div style={styles.meta}>
                  <span>By {m.creator_username}</span> · <span>Ends {new Date(m.end_time).toLocaleDateString()}</span> · <span>β={m.liquidity_beta}</span> · <span>Vol {(m.volume || 0).toFixed(2)}</span>
                </div>
                {m.tags && m.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                    {m.tags.map(t => <span key={t} style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '20px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600 }}>{t}</span>)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
