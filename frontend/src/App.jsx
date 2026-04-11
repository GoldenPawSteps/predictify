import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Markets from './pages/Markets';
import CreateMarket from './pages/CreateMarket';
import MarketDetail from './pages/MarketDetail';
import Portfolio from './pages/Portfolio';

const scrollPositions = new Map();

function ScrollRestoration() {
  const { key, pathname } = useLocation();
  const navType = useNavigationType();
  const keyRef = useRef(key);
  // Tracks the pathname from the previous render (updated by useEffect, after useLayoutEffect)
  const prevPathnameRef = useRef(null);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // Safety: clear any visibility:hidden left over from a prior navigation or HMR cycle
    document.documentElement.style.visibility = '';
    const handleScroll = () => { scrollPositions.set(keyRef.current, window.scrollY); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    keyRef.current = key;
    prevPathnameRef.current = pathname;
  }, [key, pathname]);

  useLayoutEffect(() => {
    if (navType === 'REPLACE') return;
    // Same pathname = only search params changed (tab switch, filter, etc.) — skip entirely
    if (prevPathnameRef.current !== null && pathname === prevPathnameRef.current) return;
    const saved = scrollPositions.get(key) || 0;
    window.scrollTo({ top: saved, behavior: 'instant' });
  }, [key]);

  return null;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <ScrollRestoration />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Navigate to="/markets" replace /></PrivateRoute>} />
          <Route path="/markets" element={<PrivateRoute><Markets /></PrivateRoute>} />
          <Route path="/markets/new" element={<PrivateRoute><CreateMarket /></PrivateRoute>} />
          <Route path="/markets/:id" element={<PrivateRoute><MarketDetail /></PrivateRoute>} />
          <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
