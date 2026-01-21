import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
// YENİ EKLENEN İKON: ShoppingCart (Satınalma için)
import { LayoutDashboard, Package, ArrowRightLeft, Settings, LogOut, Building2, Warehouse, FolderKanban, Network, Factory, ChevronDown, ChevronRight, PlusCircle, List, BarChart3, Filter, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  
  // Hangi menünün açık olduğunu tutan state
  const [openMenu, setOpenMenu] = useState('');

  const toggleMenu = (menuName) => {
    if (openMenu === menuName) {
      setOpenMenu('');
    } else {
      setOpenMenu(menuName);
    }
  };

  const menuItems = [
    { path: '/', name: 'Genel Durum', icon: <LayoutDashboard size={20} /> },
    
    // --- YENİ EKLENEN: SATINALMA MODÜLÜ ---
    { 
      name: 'Satınalma', 
      icon: <ShoppingCart size={20} />, // Sepet İkonu
      isSubMenu: true,
      id: 'purchasing', // Kimlik
      children: [
        { path: '/satinalma/yeni', name: 'Yeni Fatura Girişi', icon: <PlusCircle size={16} /> },
        // Henüz yapmadık ama yeri hazır olsun:
        { path: '/satinalma/gecmis', name: 'Fatura Listesi', icon: <List size={16} /> } 
      ]
    },
    // --------------------------------------

    { path: '/uretim', name: 'Üretim Fişleri', icon: <Factory size={20} /> },
    
    // --- STOK HAREKETLERİ ---
    { 
      name: 'Stok Hareketleri', 
      icon: <ArrowRightLeft size={20} />,
      isSubMenu: true,
      id: 'transactions',
      children: [
        { path: '/hareketler/ekle', name: 'Hareket Ekle', icon: <PlusCircle size={16} /> },
        { path: '/hareketler/liste', name: 'Hareket Listesi', icon: <List size={16} /> }
      ]
    },

    // --- STOK DURUMU (RAPORLAR) ---
    { 
      name: 'Stok Durumu', 
      icon: <BarChart3 size={20} />,
      isSubMenu: true,
      id: 'reports',
      children: [
        { path: '/stok-durumu/ozet', name: 'Genel Özet', icon: <List size={16} /> },
        { path: '/stok-durumu/detay', name: 'Detaylı Analiz', icon: <Filter size={16} /> }
      ]
    },

    { path: '/musteriler', name: 'Cari Listesi', icon: <Building2 size={20} /> },
    { path: '/projeler', name: 'Projeler', icon: <FolderKanban size={20} /> },
    { path: '/proje-agaci', name: 'Proje Ağacı', icon: <Network size={20} /> },
    { path: '/stoklar', name: 'Stok Listesi', icon: <Package size={20} /> },
    { path: '/depolar', name: 'Depolar', icon: <Warehouse size={20} /> },
    { path: '/ayarlar', name: 'Ayarlar', icon: <Settings size={20} /> },
  ];

  // Aktif menü kontrolü için yardımcı fonksiyon
  const isMenuActive = (item) => {
    if (item.id === 'transactions') return location.pathname.includes('/hareketler');
    if (item.id === 'reports') return location.pathname.includes('/stok-durumu');
    if (item.id === 'purchasing') return location.pathname.includes('/satinalma'); // Satınalma kontrolü
    return false;
  };

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 overflow-y-auto z-50">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400">Gem Stok</h1>
        <p className="text-xs text-slate-400 mt-1">Depo Yönetim Sistemi</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.isSubMenu ? (
              // ALT MENÜLÜ ÖĞE YAPISI
              <div>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`flex items-center justify-between w-full space-x-3 p-3 rounded-lg transition-colors 
                  ${isMenuActive(item) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  {openMenu === item.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                
                {/* Alt Linkler */}
                {(openMenu === item.id || isMenuActive(item)) && (
                  <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                    {item.children.map((subItem) => (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        className={`flex items-center space-x-2 p-2 rounded-lg text-sm transition-colors
                        ${location.pathname === subItem.path ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        {subItem.icon}
                        <span>{subItem.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // NORMAL ÖĞE YAPISI
              <Link
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
            )}
          </div>
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