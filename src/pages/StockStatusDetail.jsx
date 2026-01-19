import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Building2, Briefcase, Filter, Box, ChevronDown, Search, X } from 'lucide-react';

// --- YENİ: İÇİNDE ARAMA YAPILABİLEN SEÇİM KUTUSU ---
const SearchableSelect = ({ options, value, onChange, placeholder, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Dışarı tıklandığında kapat
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Seçili öğeyi bul
  const selectedItem = options.find(opt => opt.id === value);

  // Arama filtresi
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Görünen Kutu */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all h-[50px]
        ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-gray-700">
           {selectedItem ? (
             <>
               {Icon && <Icon size={18} className="text-blue-600 shrink-0"/>}
               <span className="font-bold truncate">{selectedItem.name}</span>
             </>
           ) : (
             <span className="text-gray-400">{placeholder}</span>
           )}
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Açılır Liste */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[99] overflow-hidden">
          
          {/* Arama Kutusu */}
          <div className="p-2 border-b bg-gray-50 sticky top-0">
             <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Listede ara..." 
                  className="w-full pl-9 p-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
             </div>
          </div>

          {/* Liste Elemanları */}
          <div className="max-h-60 overflow-y-auto">
             {filteredOptions.length === 0 ? (
               <div className="p-4 text-center text-gray-400 text-sm italic">Sonuç bulunamadı.</div>
             ) : (
               filteredOptions.map(opt => (
                 <div 
                   key={opt.id} 
                   onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(''); }}
                   className={`p-3 text-sm cursor-pointer border-b last:border-0 border-gray-100 transition-colors flex items-center gap-2
                   ${value === opt.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                 >
                   {Icon && <Icon size={16} className="opacity-50"/>}
                   {opt.name}
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- ANA SAYFA ---
const StockStatusDetail = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('Depo'); 
  const [targetList, setTargetList] = useState([]);   
  const [selectedTargetId, setSelectedTargetId] = useState(''); 
  
  const [stockData, setStockData] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Ürün arama

  useEffect(() => {
    if (user) {
      fetchTargetList(); 
    }
  }, [user]);

  // Tab değişince listeyi yenile ve seçimi sıfırla
  useEffect(() => {
    if (user) {
      fetchTargetList();
      setSelectedTargetId(''); 
      setStockData([]); 
    }
  }, [activeTab]);

  // Hedef seçilince stokları getir
  useEffect(() => {
    if (selectedTargetId) {
      fetchStockStatus();
    } else {
      setStockData([]);
    }
  }, [selectedTargetId]);

  const fetchTargetList = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;

    let data = [];
    if (activeTab === 'Depo') {
      const res = await supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId);
      data = res.data || [];
    } else {
      const res = await supabase.from('projects').select('id, name, code').eq('tenant_id', tenantId).eq('status', 'Devam Ediyor');
      data = res.data?.map(p => ({ id: p.id, name: `${p.code} - ${p.name}` })) || [];
    }
    setTargetList(data);
  };

  const fetchStockStatus = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

    const { data, error } = await supabase
      .from('stock_current_status_view')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('location_type', activeTab)
      .eq('location_id', selectedTargetId);

    if (error) console.error(error);
    else setStockData(data || []);
    
    setLoading(false);
  };

  // Ürün Filtreleme
  const filteredData = stockData.filter(item => {
    const name = item.stock_name || ''; 
    const code = item.stock_code || '';
    const term = searchTerm.toLowerCase();
    return name.toLowerCase().includes(term) || code.toLowerCase().includes(term);
  });

  return (
    <div className="p-6 w-full">
      
      {/* BAŞLIK */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Filter size={28} className="text-purple-600" /> Detaylı Stok Analizi
        </h1>
        <p className="text-sm text-gray-500 mt-1">Belirli bir depo veya projedeki anlık stok durumunu inceleyin.</p>
      </div>

      {/* --- SEÇİM PANELİ --- */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* 1. SEÇENEK: DEPO MU PROJE Mİ? */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Görüntüleme Modu</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('Depo')}
                className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all
                ${activeTab === 'Depo' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Building2 size={18} /> DEPOLAR
              </button>
              <button 
                onClick={() => setActiveTab('Proje')}
                className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all
                ${activeTab === 'Proje' ? 'bg-white text-orange-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Briefcase size={18} /> PROJELER
              </button>
            </div>
          </div>

          {/* 2. SEÇENEK: HANGİSİ? (YENİ SEARCHABLE SELECT) */}
          <div className="relative z-50"> 
             {/* z-50 verdik ki liste açılınca tablonun altında kalmasın */}
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              {activeTab === 'Depo' ? 'Hangi Depo?' : 'Hangi Proje?'}
            </label>
            
            <SearchableSelect 
              options={targetList}
              value={selectedTargetId}
              onChange={setSelectedTargetId}
              placeholder={activeTab === 'Depo' ? 'Bir Depo Seçiniz...' : 'Bir Proje Seçiniz...'}
              icon={activeTab === 'Depo' ? Building2 : Briefcase}
            />
          </div>

        </div>

        {/* 3. ARAMA: ÜRÜN ARA (Seçim yapıldıysa göster) */}
        {selectedTargetId && (
          <div className="mt-4 pt-4 border-t border-gray-100 relative">
             <Search className="absolute left-3 top-7 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Tabloda Ürün Ara..."
               className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        )}
      </div>

      {/* --- ALT PANEL (TABLO) --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[400px] relative z-0">
        
        {/* Durum Mesajları */}
        {!selectedTargetId && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
              {activeTab === 'Depo' ? <Building2 size={32} /> : <Briefcase size={32} />}
            </div>
            <p>Ürünleri görmek için yukarıdan bir <b>{activeTab}</b> arayıp seçiniz.</p>
          </div>
        )}

        {selectedTargetId && loading && (
          <div className="p-10 text-center text-gray-500">Stok durumu hesaplanıyor...</div>
        )}

        {selectedTargetId && !loading && filteredData.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Box size={40} className="mb-3 opacity-30"/>
            <p>Aradığınız kriterlere uygun stok bulunamadı.</p>
          </div>
        )}

        {/* Veri Tablosu */}
        {selectedTargetId && !loading && filteredData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Stok Kodu</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ürün Adı</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Mevcut Miktar</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Birim</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                      {item.stock_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                      {item.stock_name || <span className="text-red-500 italic">Silinmiş Ürün</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold shadow-sm
                        ${item.quantity > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.unit || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
};

export default StockStatusDetail;