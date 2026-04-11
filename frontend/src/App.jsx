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
  const { key } = useLocation();
  const navType = useNavigationType();
  const keyRef = useRef(key);

  useEffect(() => {
    const handleScroll = () => { scrollPositions.set(keyRef.current, window.scrollY); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { keyRef.current = key; }, [key]);

  useLayoutEffect(() => {
    if (navType === 'REPLACE') return;
    const saved = scrollPositions.get(key);
    if (!saved || saved <= 0) {
      window.scrollTo(0, 0);
      return;
    }

    document.documentElement.style.visibility = 'hidden';
    let rafId;

    const tryRestore = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= saved - 50) {
        window.scrollTo({ top: saved, behavior: 'instant' });
        document.documentElement.style.visibility = '';
      } else {
        rafId = requestAnimationFrame(tryRestore);
      }
    };
    rafId = requestAnimationFrame(tryRestore);

    const fallback = setTimeout(() => {
      cancelAnimationFrame(rafId);
      window.scrollTo({ top: saved, behavior: 'instant' });
      document.documentElement.style.visibility = '';
    }, 600);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(fallback);
      document.documentElement.style.visibility = '';
    };
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
