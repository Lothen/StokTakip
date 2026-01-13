// src/pages/Login.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false); // Kayıt mı Giriş mi?
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isRegister) {
      // KAYIT OLMA
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) alert(error.message);
      else alert("Kayıt başarılı! Lütfen mail kutunuzu onaylayın veya giriş yapın.");
    } else {
      // GİRİŞ YAPMA
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) alert("Giriş başarısız: " + error.message);
      else navigate('/'); // Başarılıysa anasayfaya git sadad
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Gem Stok</h2>
          <p className="text-gray-500 mt-2">Depo Yönetim Paneli</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-Posta Adresi</label>
            <input
              type="email"
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="ornek@firma.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre</label>
            <input
              type="password"
              required
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'İşlem yapılıyor...' : (isRegister ? 'Kayıt Ol' : 'Giriş Yap')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {isRegister 
              ? 'Zaten hesabınız var mı? Giriş Yapın' 
              : 'Hesabınız yok mu? Kayıt Olun'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;