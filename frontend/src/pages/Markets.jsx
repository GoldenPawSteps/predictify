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
  main: { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  h1: { fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
  createBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', textDecoration: 'none', fontSize: '0.95rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  card: { background: 'var(--surface)', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', cursor: 'pointer', transition: 'box-shadow 0.2s', display: 'block', textDecoration: 'none', color: 'inherit' },
  cardTitle: { fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.75rem' },
  priceBar: { marginBottom: '0.5rem' },
  priceLabelRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' },
  progressTrack: { height: '6px', background: 'var(--progress-track)', borderRadius: '3px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4f46e5', borderRadius: '3px' },
  meta: { marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-faint)' },
  empty: { textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  themeBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
};

function statusBadge(status) {
  const colors = { active: '#dcfce7', pending_resolution: '#fef9c3', resolved: '#e0e7ff' };
  const textColors = { active: '#166534', pending_resolution: '#854d0e', resolved: '#3730a3' };
  return { background: colors[status] || '#f3f4f6', color: textColors[status] || '#374151' };
}

const expiredBadge = { background: '#fee2e2', color: '#b91c1c' };

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get('tag') || null;
  const sortKey = searchParams.get('sort') || 'newest';
  const statusFilter = searchParams.get('status') || null;
  const creatorFilter = searchParams.get('creator') || null;
  const searchQuery = searchParams.get('q') || '';
  const { user, logout, refreshUser } = useAuth();
  const { dark, mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function setActiveTag(tag) {
    setSearchParams(p => { const n = new URLSearchParams(p); tag ? n.set('tag', tag) : n.delete('tag'); return n; }, { replace: false });
  }
  function setSortKey(key) {
    setSearchParams(p => { const n = new URLSearchParams(p); key === 'newest' ? n.delete('sort') : n.set('sort', key); return n; }, { replace: false });
  }
  function setStatusFilter(s) {
    setSearchParams(p => { const n = new URLSearchParams(p); s ? n.set('status', s) : n.delete('status'); return n; }, { replace: false });
  }
  function setCreatorFilter(c) {
    setSearchParams(p => { const n = new URLSearchParams(p); c ? n.set('creator', c) : n.delete('creator'); return n; }, { replace: false });
  }
  function setSearchQuery(q) {
    setSearchParams(p => { const n = new URLSearchParams(p); q ? n.set('q', q) : n.delete('q'); return n; }, { replace: false });
  }

  useEffect(() => {
    refreshUser();
    api.get('/markets').then(res => setMarkets(res.data.markets)).finally(() => setLoading(false));
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  const allTags = [...new Set(markets.flatMap(m => m.tags || []))].sort();
  const allCreators = [...new Set(markets.map(m => m.creator_username))].sort();

  const filteredMarkets = [...markets]
    .filter(m => {
      if (activeTag && !(m.tags || []).includes(activeTag)) return false;
      if (statusFilter) {
        const isExpired = m.status === 'active' && new Date(m.end_time) <= new Date();
        const effectiveStatus = isExpired ? 'expired' : m.status;
        if (effectiveStatus !== statusFilter) return false;
      }
      if (creatorFilter && m.creator_username !== creatorFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.question.toLowerCase().includes(q) && !(m.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortKey === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortKey === 'ending_soon') return new Date(a.end_time) - new Date(b.end_time);
      if (sortKey === 'volume') return (b.volume || 0) - (a.volume || 0);
      return 0;
    });

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
        <div style={styles.header}>
          <h1 style={styles.h1}>Prediction Markets</h1>
          <Link to="/markets/new" style={styles.createBtn}>+ Create Market</Link>
        </div>
        {!loading && (
          <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Search bar */}
            <input
              type="search"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.9rem', border: '1px solid var(--border-input2)', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)' }}
            />
            {/* Sort + Status + Creator row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint2)', fontWeight: 600 }}>Sort:</span>
                {[['newest', 'Newest'], ['oldest', 'Oldest'], ['ending_soon', 'Ending Soon'], ['volume', 'Volume']].map(([key, label]) => (
                  <button key={key} onClick={() => setSortKey(key)} style={{ background: sortKey === key ? '#1a1a2e' : 'var(--pill-bg)', color: sortKey === key ? '#fff' : 'var(--pill-text)', border: '1px solid ' + (sortKey === key ? '#1a1a2e' : 'var(--pill-border)'), borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint2)', fontWeight: 600 }}>Status:</span>
                {[null, 'active', 'expired', 'pending_resolution', 'resolved'].map(s => (
                  <button key={s ?? '__all__'} onClick={() => setStatusFilter(statusFilter === s ? null : s)} style={{ background: statusFilter === s ? '#1a1a2e' : 'var(--pill-bg)', color: statusFilter === s ? '#fff' : 'var(--pill-text)', border: '1px solid ' + (statusFilter === s ? '#1a1a2e' : 'var(--pill-border)'), borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    {s === null ? 'All' : s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            {/* Tag + Creator row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              {allTags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-faint2)', fontWeight: 600 }}>Tag:</span>
                  {[null, ...allTags].map(t => (
                    <button key={t ?? '__all__'} onClick={() => setActiveTag(activeTag === t ? null : t)} style={{ background: t === activeTag ? '#4f46e5' : 'var(--pill-bg)', color: t === activeTag ? '#fff' : 'var(--pill-text)', border: '1px solid ' + (t === activeTag ? '#4f46e5' : 'var(--pill-border)'), borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      {t === null ? 'All' : t}
                    </button>
                  ))}
                </div>
              )}
              {allCreators.length > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-faint2)', fontWeight: 600 }}>Creator:</span>
                  {[null, ...allCreators].map(c => (
                    <button key={c ?? '__all__'} onClick={() => setCreatorFilter(creatorFilter === c ? null : c)} style={{ background: creatorFilter === c ? '#059669' : 'var(--pill-bg)', color: creatorFilter === c ? '#fff' : 'var(--pill-text)', border: '1px solid ' + (creatorFilter === c ? '#059669' : 'var(--pill-border)'), borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      {c === null ? 'All' : c}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                    {m.tags.map(t => <span key={t} style={{ background: 'var(--tag-bg)', color: 'var(--tag-text)', borderRadius: '20px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 600 }}>{t}</span>)}
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
