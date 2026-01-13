import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowRightLeft, Settings, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // 1. AuthContext'i içeri aldık

const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth(); // 2. Çıkış fonksiyonunu çağırdık

  const menuItems = [
    { path: '/', name: 'Genel Durum', icon: <LayoutDashboard size={20} /> },
    { path: '/musteriler', name: 'Cari Listesi', icon: <Building2 size={20} /> },
    { path: '/stoklar', name: 'Stok Listesi', icon: <Package size={20} /> },
    { path: '/hareketler', name: 'Stok Hareketleri', icon: <ArrowRightLeft size={20} /> },
    { path: '/ayarlar', name: 'Ayarlar', icon: <Settings size={20} /> },
  ];

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400">Gem Stok</h1>
        <p className="text-xs text-slate-400 mt-1">Depo Yönetim Sistemi</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button 
          onClick={signOut} // 3. Tıklanınca çıkış yapmasını sağladık
          className="flex items-center space-x-3 text-red-400 hover:text-red-300 w-full p-2 transition-colors"
        >
          <LogOut size={20} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;