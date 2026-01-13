import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sol Menü */}
      <Sidebar />

      {/* Ana İçerik Alanı - Sol menü kadar boşluk (ml-64) bırakıyoruz */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;