import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Markets from './pages/Markets';
import CreateMarket from './pages/CreateMarket';
import MarketDetail from './pages/MarketDetail';
import Portfolio from './pages/Portfolio';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
