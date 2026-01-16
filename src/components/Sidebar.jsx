import React from 'react';
import { Link, useLocation } from 'react-router-dom';
// 1. Network ikonunu import listesine ekledik
import { LayoutDashboard, Package, ArrowRightLeft, Settings, LogOut, Building2, Warehouse, FolderKanban, Network } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  const menuItems = [
    { path: '/', name: 'Genel Durum', icon: <LayoutDashboard size={20} /> },
    { path: '/musteriler', name: 'Cari Listesi', icon: <Building2 size={20} /> },
    { path: '/projeler', name: 'Projeler', icon: <FolderKanban size={20} /> },
    // 2. Yeni Proje Ağacı sekmesini buraya ekledik
    { path: '/proje-agaci', name: 'Proje Ağacı', icon: <Network size={20} /> },
    { path: '/stoklar', name: 'Stok Listesi', icon: <Package size={20} /> },
    { path: '/depolar', name: 'Depolar', icon: <Warehouse size={20} /> },
    //{ path: '/hareketler', name: 'Stok Hareketleri', icon: <ArrowRightLeft size={20} /> },
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
          onClick={signOut}
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