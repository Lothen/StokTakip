// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; 

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Stocks from './pages/Stocks';
import Warehouses from './pages/Warehouses';
import Projects from './pages/Projects'; 
import ProjectTree from './pages/ProjectTree'; // <--- 1. YENİ EKLENEN (Ağaç Görünümü)
//import StockTransactions from './pages/StockTransactions'; // <--- 2. EKSİK OLAN (Hareketler)
import Login from './pages/Login';

// Korumalı Rota Bileşeni
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  // Eğer kullanıcı yoksa Login'e gönder
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Kullanıcı varsa sayfayı göster (Layout içinde)
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Herkese Açık Login Sayfası */}
          <Route path="/login" element={<Login />} />

          {/* Korumalı Sayfalar */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/musteriler" element={
            <ProtectedRoute>
              <Companies />
            </ProtectedRoute>
          } />

          {/* Projeler Listesi */}
          <Route path="/projeler" element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } />

          {/* YENİ ROTA: Proje Ağacı (Hiyerarşi) */}
          <Route path="/proje-agaci" element={
            <ProtectedRoute>
              <ProjectTree />
            </ProtectedRoute>
          } />

          <Route path="/stoklar" element={
            <ProtectedRoute>
              <Stocks />
            </ProtectedRoute>
          } />

          <Route path="/depolar" element={
            <ProtectedRoute>
              <Warehouses />
            </ProtectedRoute>
          } />

          {/* Stok Hareketleri */}
          <Route path="/hareketler" element={
            <ProtectedRoute>
              {/*  <StockTransactions /> */}
            </ProtectedRoute>
          } />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;