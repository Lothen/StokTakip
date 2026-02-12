// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; 

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Stocks from './pages/Stocks';
import Warehouses from './pages/Warehouses';
import Projects from './pages/Projects'; 
import ProjectTree from './pages/ProjectTree';
import Production from './pages/Production'; 
import StockTransactions from './pages/StockTransactions'; 
import StockTransactionList from './pages/StockTransactionList.jsx'; 
import StockStatusSummary from './pages/StockStatusSummary'; 
import StockStatusDetail from './pages/StockStatusDetail'; 
// --- SATINALMA IMPORTLARI ---
import PurchaseInvoice from './pages/PurchaseInvoice';
import PurchaseInvoiceList from './pages/PurchaseInvoiceList'; 
// --- STOK GİRİŞ FİŞİ (YENİ EKLENDİ) ---
import StockEntry from './pages/StockEntry';

import Login from './pages/Login';

// Korumalı Rota Bileşeni
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
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
          
          {/* ÜRETİM MODÜLÜ */}
          <Route path="/uretim" element={
            <ProtectedRoute>
              <Production />
            </ProtectedRoute>
          } />

          {/* --- SATINALMA (MAL KABUL) MODÜLÜ --- */}
          <Route path="/satinalma/yeni" element={
            <ProtectedRoute>
              <PurchaseInvoice />
            </ProtectedRoute>
          } />

          <Route path="/satinalma/duzenle/:documentNo" element={
            <ProtectedRoute>
              <PurchaseInvoice />
            </ProtectedRoute>
          } />

          <Route path="/satinalma/gecmis" element={ 
            <ProtectedRoute>
              <PurchaseInvoiceList />
            </ProtectedRoute>
          } />
          
          {/* --- STOK GİRİŞ FİŞİ (DEVİR) - YENİ --- */}
          <Route path="/stok-giris-fisi" element={
            <ProtectedRoute>
              <StockEntry />
            </ProtectedRoute>
          } />

          {/* --- STOK HAREKETLERİ MODÜLÜ --- */}
          <Route path="/hareketler/ekle" element={
            <ProtectedRoute>
              <StockTransactions />
            </ProtectedRoute>
          } />

          <Route path="/hareketler/liste" element={
            <ProtectedRoute>
              <StockTransactionList />
            </ProtectedRoute>
          } />

          <Route path="/hareketler/duzenle/:docNo" element={
            <ProtectedRoute>
              <StockTransactions />
            </ProtectedRoute>
          } />

          {/* --- STOK RAPORLARI / DURUMU --- */}
          
          {/* 1. Genel Özet (Stok Ekstresi) */}
          <Route path="/stok-durumu/ozet" element={
            <ProtectedRoute>
              <StockStatusSummary />
            </ProtectedRoute>
          } />

          {/* 2. Detaylı Analiz */}
          <Route path="/stok-durumu/detay" element={
            <ProtectedRoute>
              <StockStatusDetail />
            </ProtectedRoute>
          } />

          <Route path="/musteriler" element={
            <ProtectedRoute>
              <Companies />
            </ProtectedRoute>
          } />

          <Route path="/projeler" element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } />

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

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;