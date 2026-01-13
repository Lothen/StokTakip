// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // Context'i import ettik

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
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

          {/* Diğer sayfalar da buraya ProtectedRoute içinde eklenecek */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;