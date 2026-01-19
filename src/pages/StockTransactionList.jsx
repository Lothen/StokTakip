import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Search, Edit, Trash2, ArrowRight, Building2, Briefcase, Calendar, Filter, X, Layers, ChevronDown, MapPin } from 'lucide-react';

// --- (YENİ) BU SAYFA İÇİN ÖZEL ARAMALI SELECT BİLEŞENİ ---
const FilterSelect = ({ options, value, onChange, placeholder }) => {
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
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full p-2 border rounded-lg text-sm bg-white cursor-pointer flex items-center justify-between h-[38px] hover:border-gray-400 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
           {selectedItem ? (
             <>
               {selectedItem.type === 'Depo' ? <Building2 size={14} className="text-blue-500"/> : <Briefcase size={14} className="text-orange-500"/>}
               <span className="truncate text-gray-800 font-medium">{selectedItem.name}</span>
             </>
           ) : (
             <span className="text-gray-400">{placeholder}</span>
           )}
        </div>
        <ChevronDown size={14} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-[999] overflow-hidden max-h-60 flex flex-col">
          <div className="p-2 border-b bg-gray-50 sticky top-0">
             <input 
               autoFocus
               type="text" 
               placeholder="Ara..." 
               className="w-full p-1.5 text-sm border rounded focus:outline-none focus:border-blue-500"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
          <div className="overflow-y-auto flex-1">
             <div 
               onClick={() => { onChange(''); setIsOpen(false); }}
               className="p-2 text-sm cursor-pointer hover:bg-gray-100 text-gray-500 border-b border-gray-100 italic"
             >
               Tümü (Filtre Yok)
             </div>
             {filteredOptions.length === 0 ? (
               <div className="p-3 text-center text-gray-400 text-xs">Sonuç yok</div>
             ) : (
               filteredOptions.map(opt => (
                 <div 
                   key={opt.uniqueKey} // uniqueKey kullanıyoruz çünkü ID'ler çakışabilir
                   onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(''); }}
                   className={`p-2 text-sm cursor-pointer border-b border-gray-50 hover:bg-blue-50 flex items-center gap-2
                   ${value === opt.id ? 'bg-blue-100 font-bold text-blue-800' : 'text-gray-700'}`}
                 >
                   {opt.type === 'Depo' ? <Building2 size={14} className="text-blue-400"/> : <Briefcase size={14} className="text-orange-400"/>}
                   <span>{opt.name}</span>
                   <span className="ml-auto text-[10px] uppercase text-gray-400 bg-gray-100 px-1 rounded">{opt.type}</span>
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const StockTransactionList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Veri State'leri
  const [transactions, setTransactions] = useState([]);
  const [allLocations, setAllLocations] = useState([]); // Depolar + Projeler
  const [loading, setLoading] = useState(true);

  // Filtre State'leri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterLocation, setFilterLocation] = useState(''); // Hem depo hem proje ID'si olabilir
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (user) fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      const tenantId = profile?.tenant_id;

      // 1. Depoları ve Projeleri Çekip Birleştir
      const { data: whData } = await supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId);
      const { data: prjData } = await supabase.from('projects').select('id, name, code').eq('tenant_id', tenantId).eq('status', 'Devam Ediyor');

      // Birleşik Liste Oluşturma
      const combined = [
        ...(whData || []).map(w => ({ ...w, type: 'Depo', uniqueKey: `w-${w.id}` })),
        ...(prjData || []).map(p => ({ id: p.id, name: `${p.code} - ${p.name}`, type: 'Proje', uniqueKey: `p-${p.id}` }))
      ];
      setAllLocations(combined);

      // 2. Stok Hareketlerini Çek
      const { data: trData, error } = await supabase
        .from('stock_transactions')
        .select(`*, stocks (name, stock_code), warehouses:warehouse_id (name), projects (name, code)`)
        .eq('tenant_id', tenantId)
        .order('document_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(processTransactions(trData));

    } catch (err) {
      console.error('Hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const processTransactions = (rawData) => {
    const groups = {};
    rawData.forEach(item => {
      const docNo = item.document_no;
      if (!groups[docNo]) {
        groups[docNo] = {
          document_no: docNo,
          document_date: item.document_date,
          description: item.description,
          transaction_type: item.transaction_type,
          itemCount: 0,
          outLocation: null,
          inLocation: null
        };
      }
      
      if (item.direction === -1 || (item.transaction_type === 'production_return' && item.direction === 1)) {
         groups[docNo].itemCount += 1;
      }

      if (item.direction === -1) {
        groups[docNo].outLocation = item.warehouses 
          ? { type: 'Depo', name: item.warehouses.name, id: item.warehouse_id } 
          : item.projects 
          ? { type: 'Proje', name: `${item.projects.code} - ${item.projects.name}`, id: item.project_id } 
          : { type: '-', name: 'Dış Kaynak', id: null };
      } else {
        groups[docNo].inLocation = item.warehouses 
          ? { type: 'Depo', name: item.warehouses.name, id: item.warehouse_id } 
          : item.projects 
          ? { type: 'Proje', name: `${item.projects.code} - ${item.projects.name}`, id: item.project_id } 
          : { type: '-', name: 'Dış Kaynak', id: null };
      }
    });
    return Object.values(groups);
  };

  const handleDelete = async (docNo) => {
    if (!window.confirm('Bu fişe ait TÜM kayıtlar silinecek. Emin misiniz?')) return;
    const { error } = await supabase.from('stock_transactions').delete().eq('document_no', docNo);
    if (error) alert('Hata: ' + error.message);
    else setTransactions(transactions.filter(t => t.document_no !== docNo));
  };

  const handleEditClick = (docNo) => {
    navigate(`/hareketler/duzenle/${docNo}`);
  };

  // --- GELİŞMİŞ FİLTRELEME ---
  const filteredData = transactions.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.document_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const itemDate = new Date(item.document_date);
    const matchesStartDate = !filterStartDate || itemDate >= new Date(filterStartDate);
    const matchesEndDate = !filterEndDate || itemDate <= new Date(filterEndDate);

    // YENİ: Hem Depo Hem Proje ID'sine bakar
    const matchesLocation = !filterLocation || 
      item.outLocation?.id === filterLocation ||
      item.inLocation?.id === filterLocation;

    let matchesType = true;
    if (filterType) {
        if (filterType === 'w2w') matchesType = item.transaction_type.includes('transfer') && !item.transaction_type.includes('project');
        else if (filterType === 'w2p') matchesType = item.transaction_type === 'production_out';
        else if (filterType === 'p2w') matchesType = item.transaction_type === 'production_return';
        else if (filterType === 'p2p') matchesType = item.transaction_type.includes('project_transfer');
    }

    return matchesSearch && matchesStartDate && matchesEndDate && matchesLocation && matchesType;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterLocation('');
    setFilterType('');
  };

  const LocationBadge = ({ loc }) => {
    if (!loc) return <span className="text-gray-400">-</span>;
    const isProject = loc.type === 'Proje';
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold border 
        ${isProject ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
        {isProject ? <Briefcase size={12}/> : <Building2 size={12}/>}
        <span className="truncate max-w-[150px]" title={loc.name}>{loc.name}</span>
      </div>
    );
  };

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ArrowRightLeft size={28} className="text-blue-600" /> Stok Hareket Listesi
          </h1>
          <p className="text-sm text-gray-500 mt-1">Giriş, çıkış ve transfer hareketleri</p>
        </div>
      </div>

      {/* --- FİLTRE PANELİ --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-2 mb-3 text-gray-700 font-bold text-sm">
            <Filter size={16} /> Filtreleme Seçenekleri
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Metin Arama */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input type="text" placeholder="Fiş No Ara..." className="w-full pl-9 p-2 border rounded-lg text-sm focus:border-blue-500 outline-none"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* Hareket Tipi */}
            <select className="w-full p-2 border rounded-lg text-sm bg-white focus:border-blue-500 outline-none"
                value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tüm Hareketler</option>
                <option value="w2w">Depodan Depoya</option>
                <option value="w2p">Depodan Projeye</option>
                <option value="p2w">Projeden Depoya</option>
                <option value="p2p">Projeden Projeye</option>
            </select>

            {/* GÜNCELLENEN KISIM: Lokasyon Seçimi (Depo + Proje) */}
            <div className="relative z-50">
               <FilterSelect 
                  options={allLocations}
                  value={filterLocation}
                  onChange={setFilterLocation}
                  placeholder="Depo veya Proje Seç..."
               />
            </div>

            {/* Tarih Aralığı */}
            <div className="flex gap-2">
                <input type="date" className="w-full p-2 border rounded-lg text-xs focus:border-blue-500 outline-none"
                    value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} title="Başlangıç" />
                <input type="date" className="w-full p-2 border rounded-lg text-xs focus:border-blue-500 outline-none"
                    value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} title="Bitiş" />
            </div>

            <button onClick={clearFilters} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm flex items-center justify-center gap-2 transition-colors">
                <X size={16} /> Temizle
            </button>
        </div>
      </div>

      {/* TABLO */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative z-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500">TARİH / FİŞ NO</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500">HAREKET TİPİ</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500">KAYNAK (ÇIKIŞ)</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500"><ArrowRight size={16} className="mx-auto"/></th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500">HEDEF (GİRİŞ)</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500">KALEM</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-10 text-center text-gray-500">Yükleniyor...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-10 text-center text-gray-500">Kayıt bulunamadı.</td></tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.document_no} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1 text-sm font-bold text-gray-800">
                           <Calendar size={14} className="text-gray-400"/> {row.document_date}
                        </div>
                        <span className="text-xs text-gray-500 font-mono mt-1 bg-gray-100 px-1 rounded w-fit">{row.document_no}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="text-xs text-gray-600 font-medium">
                            {row.transaction_type.includes('transfer') && !row.transaction_type.includes('project') ? 'Depo Transferi' : 
                             row.transaction_type === 'production_out' ? 'Projeye Sevk' :
                             row.transaction_type === 'production_return' ? 'Projeden İade' :
                             row.transaction_type.includes('project_transfer') ? 'Proje Transferi' : 'Diğer'}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{row.description}</div>
                    </td>
                    <td className="px-6 py-4"><LocationBadge loc={row.outLocation} /></td>
                    <td className="px-2 py-4 text-center text-gray-300"><ArrowRight size={16} className="mx-auto"/></td>
                    <td className="px-6 py-4"><LocationBadge loc={row.inLocation} /></td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 bg-gray-100 px-2 py-1 rounded-full w-fit mx-auto">
                            <Layers size={14} className="text-gray-500" />
                            <span className="text-sm font-bold text-gray-700">{row.itemCount}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => handleEditClick(row.document_no)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full mr-2" title="Detay/Düzenle">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(row.document_no)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full" title="Tüm Hareketi Sil">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockTransactionList;