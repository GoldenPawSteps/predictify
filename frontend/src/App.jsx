import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Markets from './pages/Markets';
import CreateMarket from './pages/CreateMarket';
import MarketDetail from './pages/MarketDetail';
import Portfolio from './pages/Portfolio';

const scrollPositions = new Map();

function ScrollRestoration() {
  const { key } = useLocation();
  const keyRef = useRef(key);

  useEffect(() => {
    const handleScroll = () => { scrollPositions.set(keyRef.current, window.scrollY); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { keyRef.current = key; }, [key]);

  useEffect(() => {
    const saved = scrollPositions.get(key);
    if (saved !== undefined) {
      const rafId = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
      const timeoutId = setTimeout(() => window.scrollTo(0, saved), 300);
      return () => { cancelAnimationFrame(rafId); clearTimeout(timeoutId); };
    } else {
      window.scrollTo(0, 0);
    }
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
  );
}
