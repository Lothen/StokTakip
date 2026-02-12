import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Building2, Briefcase, ChevronDown, Calendar, ArrowRight, Filter, X, ExternalLink, RefreshCw } from 'lucide-react';

// --- ARAMALI SEÇİM BİLEŞENİ (Değişmedi) ---
const SearchableSelect = ({ options, value, onChange, placeholder, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const selectedItem = options.find(opt => opt.id === value);
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.code && opt.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border rounded-lg cursor-pointer flex items-center justify-between bg-white h-[50px]
        ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-gray-700 w-full">
           {selectedItem ? (
             <>
               {Icon && <Icon size={18} className="text-blue-600 shrink-0"/>}
               <div className="flex flex-col truncate leading-tight">
                 <span className="font-bold text-sm truncate">{selectedItem.name}</span>
                 {selectedItem.code && <span className="text-[10px] text-gray-400 font-mono">{selectedItem.code}</span>}
               </div>
             </>
           ) : (
             <span className="text-gray-400 text-sm">{placeholder}</span>
           )}
        </div>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[99] overflow-hidden">
          <div className="p-2 border-b bg-gray-50 sticky top-0">
             <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Ara..." 
                  className="w-full pl-9 p-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
             </div>
          </div>
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
                   <div>
                     <div className="font-medium">{opt.name}</div>
                     {opt.code && <div className="text-[10px] text-gray-400 font-mono">{opt.code}</div>}
                   </div>
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
const StockStatusSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  
  // State'ler
  const [selectedStockId, setSelectedStockId] = useState('');
  const [locationType, setLocationType] = useState('all'); 
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Veriler
  const [stockList, setStockList] = useState([]);
  const [locationList, setLocationList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  // İsim Eşleştirme Sözlükleri
  const [warehouseMap, setWarehouseMap] = useState({});
  const [projectMap, setProjectMap] = useState({});

  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ in: 0, out: 0, balance: 0 });

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (user && locationType !== 'all') {
      updateLocationDropdown();
      setSelectedLocationId('');
    }
  }, [locationType]);

  useEffect(() => {
    if (selectedStockId) {
      fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [selectedStockId, locationType, selectedLocationId, startDate, endDate]);

  const fetchInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    const tenantId = profile.tenant_id;

    // A. Stokları Çek
    const { data: stocks } = await supabase.from('stocks').select(`id, name, stock_code, units (name)`).eq('tenant_id', tenantId);
    setStockList(stocks?.map(s => ({ id: s.id, name: s.name, code: s.stock_code, unit: s.units?.name || '-' })) || []);

    // B. Depoları Çek ve Map Oluştur
    const { data: wh } = await supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId);
    const wMap = {};
    wh?.forEach(w => wMap[w.id] = w.name);
    setWarehouseMap(wMap);

    // C. Projeleri Çek ve Map Oluştur
    const { data: prj } = await supabase.from('projects').select('id, name, code').eq('tenant_id', tenantId);
    const pMap = {};
    prj?.forEach(p => pMap[p.id] = `${p.code} - ${p.name}`);
    setProjectMap(pMap);
  };

  const updateLocationDropdown = () => {
    if (locationType === 'Depo') {
      const list = Object.keys(warehouseMap).map(id => ({ id, name: warehouseMap[id] }));
      setLocationList(list);
    } else if (locationType === 'Proje') {
      const list = Object.keys(projectMap).map(id => ({ id, name: projectMap[id] }));
      setLocationList(list);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

    let query = supabase
      .from('stock_transactions')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('stock_id', selectedStockId)
      .order('document_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (locationType === 'Depo' && selectedLocationId) query = query.eq('warehouse_id', selectedLocationId);
    if (locationType === 'Proje' && selectedLocationId) query = query.eq('project_id', selectedLocationId);
    if (startDate) query = query.gte('document_date', startDate);
    if (endDate) query = query.lte('document_date', endDate);

    const { data, error } = await query;
    if (error) console.error(error);
    else {
      setTransactions(data || []);
      calculateTotals(data || []);
    }
    setLoading(false);
  };

  const calculateTotals = (data) => {
    let totalIn = 0;
    let totalOut = 0;
    data.forEach(t => {
      if (t.direction === 1) totalIn += t.quantity;
      else totalOut += t.quantity;
    });
    setTotals({ in: totalIn, out: totalOut, balance: totalIn - totalOut });
  };

  // --- NEREDEN -> NEREYE MANTIĞI (GÜNCELLENDİ) ---
  const TransactionRoute = ({ row }) => {
    const getBadge = (id, type) => {
      if (!id) return null;
      if (type === 'warehouse') return { name: warehouseMap[id] || 'Silinmiş Depo', color: 'blue', icon: Building2 };
      if (type === 'project') return { name: projectMap[id] || 'Silinmiş Proje', color: 'orange', icon: Briefcase };
      return { name: 'Dış Kaynak', color: 'gray', icon: ExternalLink }; 
    };

    let fromBadge = null;
    let toBadge = null;

    if (row.direction === -1) {
      // --- ÇIKIŞ İŞLEMİ ---
      if (row.warehouse_id) fromBadge = getBadge(row.warehouse_id, 'warehouse');
      else if (row.project_id) fromBadge = getBadge(row.project_id, 'project');

      if (row.related_warehouse_id) toBadge = getBadge(row.related_warehouse_id, 'warehouse');
      else if (row.transaction_type === 'production_out') toBadge = getBadge(row.project_id, 'project');
      else toBadge = { name: 'Dış/Tüketim', color: 'gray', icon: ExternalLink };

    } else {
      // --- GİRİŞ İŞLEMİ ---
      if (row.warehouse_id) toBadge = getBadge(row.warehouse_id, 'warehouse');
      else if (row.project_id) toBadge = getBadge(row.project_id, 'project');

      // Kaynak Belirleme (GÜNCELLENEN KISIM)
      if (row.related_warehouse_id) {
          fromBadge = getBadge(row.related_warehouse_id, 'warehouse');
      } else if (row.transaction_type === 'production_return') {
          fromBadge = getBadge(row.project_id, 'project');
      } else if (row.transaction_type === 'stock_in') {
          // Stok Giriş Fişi (Sayım/Devir)
          fromBadge = { name: 'Hızlı Giriş / Devir', color: 'purple', icon: RefreshCw };
      } else if (row.transaction_type === 'purchase') {
          // Satınalma Faturası
          fromBadge = { name: 'Tedarikçi (Satınalma)', color: 'green', icon: ExternalLink };
      } else {
          fromBadge = { name: 'Dış Kaynak', color: 'gray', icon: ExternalLink };
      }
    }

    const renderBadge = (badge) => {
      if (!badge) return <span className="text-xs text-gray-400">-</span>;
      const Icon = badge.icon;
      let colorClass = 'text-gray-600 bg-gray-100 border-gray-200';
      if (badge.color === 'blue') colorClass = 'text-blue-700 bg-blue-50 border-blue-100';
      if (badge.color === 'orange') colorClass = 'text-orange-700 bg-orange-50 border-orange-100';
      if (badge.color === 'purple') colorClass = 'text-purple-700 bg-purple-50 border-purple-100';
      if (badge.color === 'green') colorClass = 'text-green-700 bg-green-50 border-green-100';

      return (
        <div className={`flex items-center gap-1 text-[10px] md:text-xs font-bold px-2 py-1 rounded border ${colorClass}`}>
          <Icon size={12} /> <span className="truncate max-w-[80px] md:max-w-[120px]">{badge.name}</span>
        </div>
      );
    };

    return (
      <div className="flex items-center gap-2">
        {renderBadge(fromBadge)}
        <ArrowRight size={14} className="text-gray-400 shrink-0" />
        {renderBadge(toBadge)}
      </div>
    );
  };

  const clearDates = () => { setStartDate(''); setEndDate(''); };

  // --- YÖNLENDİRME MANTIĞI (GÜNCELLENDİ) ---
  const handleRowClick = (row) => {
    // 1. Hızlı Stok Girişi ise o sayfaya git
    if (row.transaction_type === 'stock_in') {
        navigate(`/stok-giris-fisi?docNo=${row.document_no}`);
    } 
    // 2. Fatura Girişi ise Satınalma (Fatura) Düzenleme ekranına
    else if (row.transaction_type === 'purchase') {
        navigate(`/satinalma/duzenle/${row.document_no}`);
    } 
    // 3. Üretim ise Üretim ekranına
    else if (row.transaction_type === 'production' || row.transaction_type === 'usage') {
        navigate(`/uretim?docNo=${row.document_no}`);
    } 
    // 4. Diğerleri (Transfer vb.)
    else {
        navigate(`/hareketler/duzenle/${row.document_no}`);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText size={28} className="text-blue-600" /> Stok Ekstresi
        </h1>
        <p className="text-sm text-gray-500 mt-1">Ürün hareket tarihçesi ve detaylı rota takibi.</p>
      </div>

      {/* --- FİLTRE PANELİ --- */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">İncelenecek Ürün</label>
            <SearchableSelect options={stockList} value={selectedStockId} onChange={setSelectedStockId} placeholder="Ürün Ara..." icon={Search}/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Filtreleme Tipi</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                <option value="all">Tüm Şirket</option>
                <option value="Depo">Depo Bazlı</option>
                <option value="Proje">Proje Bazlı</option>
              </select>
            </div>
            <div className="relative z-10">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Konum</label>
              {locationType === 'all' ? (
                <input type="text" disabled value="Hepsi" className="w-full p-3 border bg-gray-100 rounded-lg text-gray-400 text-sm italic"/>
              ) : (
                <SearchableSelect options={locationList} value={selectedLocationId} onChange={setSelectedLocationId} placeholder="Seçiniz..." icon={locationType === 'Depo' ? Building2 : Briefcase}/>
              )}
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Başlangıç</label>
                <input type="date" className="w-full p-3 border border-gray-300 rounded-lg text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
            </div>
            <div className="flex gap-2">
                <div className="w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bitiş</label>
                    <input type="date" className="w-full p-3 border border-gray-300 rounded-lg text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)}/>
                </div>
                {(startDate || endDate) && (
                    <button onClick={clearDates} className="mb-1 p-3 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-lg transition-colors"><X size={20}/></button>
                )}
            </div>
        </div>
      </div>

      {/* --- ÖZET KARTLARI --- */}
      {selectedStockId && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="text-xs text-green-600 font-bold uppercase mb-1">Giriş</div>
            <div className="text-2xl font-bold text-green-700">{totals.in}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <div className="text-xs text-red-600 font-bold uppercase mb-1">Çıkış</div>
            <div className="text-2xl font-bold text-red-700">{totals.out}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="text-xs text-blue-600 font-bold uppercase mb-1">Bakiye</div>
            <div className="text-2xl font-bold text-blue-700">{totals.balance}</div>
          </div>
        </div>
      )}

      {/* --- TABLO --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[300px]">
        {!selectedStockId ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Search size={48} className="mb-4 opacity-20" /><p>Ürün seçiniz.</p></div>
        ) : loading ? (
           <div className="p-10 text-center text-gray-500">Yükleniyor...</div>
        ) : transactions.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Filter size={48} className="mb-4 opacity-20" /><p>Kayıt yok.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fiş No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Hareket Yönü (Nereden -&gt; Nereye)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Miktar</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((t, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => handleRowClick(t)} // GÜNCELLENDİ: Tüm satır objesini gönder
                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                    title="Fiş detayına gitmek için tıklayın"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <Calendar size={14} className="text-gray-400"/> {t.document_date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-blue-600 group-hover:underline">{t.document_no}</div>
                      <div className="text-[10px] text-gray-400 mt-1 truncate max-w-[150px]">{t.description}</div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <TransactionRoute row={t} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${t.direction === 1 ? 'text-green-700' : 'text-red-700'}`}>
                        {t.direction === 1 ? '+' : ''}{t.quantity}
                      </span>
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

export default StockStatusSummary;