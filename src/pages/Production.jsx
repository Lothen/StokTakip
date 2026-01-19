import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Factory, Save, Package, ArrowRight, ArrowLeft, RotateCcw, Plus, Trash2, List, FileText, MapPin, Calendar, Search, ChevronDown } from 'lucide-react';

// --- ÖZEL ARANABİLİR SELECT BİLEŞENİ (GÜNCELLENDİ: Şeffaflık Giderildi) ---
const SearchableSelect = ({ options, value, onChange, placeholder, icon: Icon, formatLabel }) => {
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

  const filteredOptions = options.filter(opt => {
    const label = formatLabel(opt).toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Seçim Kutusu */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border-2 rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all h-12 relative z-10
        ${isOpen ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
           {Icon && <Icon size={18} className="text-gray-500 flex-shrink-0" />}
           <span className={`truncate ${selectedItem ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
             {selectedItem ? formatLabel(selectedItem) : placeholder}
           </span>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Açılır Liste (DÜZELTME: bg-white ve yüksek z-index eklendi) */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] overflow-hidden">
          
          {/* Arama Inputu */}
          <div className="p-2 border-b bg-gray-50 sticky top-0 z-20">
             <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Ara..." 
                  className="w-full pl-9 p-2 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500 placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          {/* Liste Öğeleri */}
          <div className="max-h-60 overflow-y-auto bg-white">
             {filteredOptions.length === 0 ? (
               <div className="p-4 text-center text-gray-500 text-sm bg-white">Sonuç bulunamadı.</div>
             ) : (
               filteredOptions.map(opt => (
                 <div 
                   key={opt.id}
                   onClick={() => {
                     onChange(opt.id);
                     setIsOpen(false);
                     setSearchTerm('');
                   }}
                   className={`p-3 text-sm cursor-pointer border-b last:border-0 border-gray-100 transition-colors
                   ${value === opt.id ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-800 hover:bg-gray-100 bg-white'}`}
                 >
                   {formatLabel(opt)}
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
};
// --------------------------------------------------------

const Production = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  const [activeTab, setActiveTab] = useState('out');
  const [loading, setLoading] = useState(false);

  const [headData, setHeadData] = useState({
    project_id: '',
    warehouse_id: '',
    document_no: '',
    description: '',
    document_date: new Date().toISOString().split('T')[0]
  });

  const [lineItems, setLineItems] = useState([]);

  const [newLine, setNewLine] = useState({
    stock_id: '',
    quantity: ''
  });

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  useEffect(() => {
    generateDocNo();
  }, [activeTab]);

  const generateDocNo = () => {
    const prefix = activeTab === 'out' ? 'OUT' : activeTab === 'in' ? 'IN' : 'RET';
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const random = Math.floor(1000 + Math.random() * 9000);
    setHeadData(prev => ({ ...prev, document_no: `${prefix}-${dateStr}-${random}` }));
  };

  const loadInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (profile) {
      setTenantId(profile.tenant_id);

      const { data: projData } = await supabase.from('projects')
        .select('id, name, code')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'Devam Ediyor');
      
      const { data: stockData } = await supabase.from('stocks').select('id, name, stock_code').eq('tenant_id', profile.tenant_id);
      
      const { data: whData } = await supabase.from('warehouses').select('id, name').eq('tenant_id', profile.tenant_id);

      setProjects(projData || []);
      setStocks(stockData || []);
      setWarehouses(whData || []);
    }
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    if (!newLine.stock_id) return alert("Lütfen bir malzeme seçin!");
    if (!newLine.quantity || Number(newLine.quantity) <= 0) return alert("Geçerli bir miktar girin!");

    const selectedStock = stocks.find(s => s.id === newLine.stock_id);

    const newItem = {
      ...newLine,
      stock_name: selectedStock.name,
      stock_code: selectedStock.stock_code,
      id: Date.now()
    };

    setLineItems([...lineItems, newItem]);
    setNewLine({ stock_id: '', quantity: '' });
  };

  const handleRemoveLine = (id) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleSaveAll = async () => {
    if (!headData.project_id) return alert("Lütfen Proje seçin!");
    if (!headData.warehouse_id) return alert("Lütfen Depo seçin!");
    if (!headData.document_no) return alert("Fiş numarası boş olamaz!");
    if (lineItems.length === 0) return alert("Listeye hiç ürün eklemediniz!");

    setLoading(true);

    let transactionType = '';
    let direction = 0;

    if (activeTab === 'out') {
      transactionType = 'production_out'; 
      direction = -1; 
    } else if (activeTab === 'in') {
      transactionType = 'production_in'; 
      direction = 1; 
    } else if (activeTab === 'return') {
      transactionType = 'production_return'; 
      direction = 1; 
    }

    const records = lineItems.map(item => ({
      tenant_id: tenantId,
      created_by: user.id,
      project_id: headData.project_id,
      warehouse_id: headData.warehouse_id,
      document_no: headData.document_no,
      document_date: headData.document_date, 
      description: headData.description,
      stock_id: item.stock_id,
      quantity: item.quantity,
      transaction_type: transactionType,
      direction: direction,
      company_id: null,
      related_warehouse_id: null,
    }));

    const { error } = await supabase.from('stock_transactions').insert(records);

    if (error) {
      alert("Hata oluştu: " + error.message);
    } else {
      alert(`Fiş No: ${headData.document_no}\n${lineItems.length} kalem ürün başarıyla kaydedildi!`);
      setLineItems([]);
      setNewLine({ stock_id: '', quantity: '' });
      generateDocNo();
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      
      {/* --- ÜST BAŞLIK VE KAYDET BUTONU --- */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-md border border-gray-200 sticky top-0 z-[1000]">
        
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Factory size={28} className="text-blue-600" /> Üretim Fişleri
           </h1>
        </div>

        <div className="flex items-center gap-6 ml-auto">
            <div className="text-right">
                <span className="block text-xs text-gray-500 font-bold uppercase">Liste Durumu</span>
                <span className="text-blue-600 font-bold text-lg">Toplam {lineItems.length} Kalem</span>
            </div>

            <button 
              onClick={handleSaveAll}
              disabled={loading || lineItems.length === 0}
              className={`h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-md transition-colors min-w-[200px] ${
                loading || lineItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Save size={24} />
              <span>KAYDET VE TAMAMLA</span>  
            </button>
        </div>
      </div>

      {/* --- SEKMELER --- */}
      <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
        <button onClick={() => { setActiveTab('out'); setLineItems([]); }}
          className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all 
          ${activeTab === 'out' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
          <ArrowRight size={24} className="mb-1" /> HAMMADDE ÇIKIŞI
        </button>
        <button onClick={() => { setActiveTab('in'); setLineItems([]); }}
          className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all 
          ${activeTab === 'in' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
          <ArrowLeft size={24} className="mb-1" /> MAMUL GİRİŞİ
        </button>
        <button onClick={() => { setActiveTab('return'); setLineItems([]); }}
          className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all 
          ${activeTab === 'return' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
          <RotateCcw size={24} className="mb-1" /> ÜRETİMDEN İADE
        </button>
      </div>

      {/* DÜZELTME: overflow-visible eklendi ki liste dışarı taşabilsin */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-600 overflow-visible relative z-20">
        
        {/* --- FORM BAŞLIK ALANI --- */}
        <div className="p-6 bg-gray-50 border-b-2 border-gray-200 relative z-30">
          <div className="grid grid-cols-2 gap-6 mb-4 relative z-40">
            
            {/* PROJE SEÇİMİ (ARANABİLİR) */}
            <div className='relative z-50'>
              <label className="block text-sm font-extrabold text-gray-800 mb-1">HANGİ PROJE?</label>
              <SearchableSelect 
                options={projects}
                value={headData.project_id}
                onChange={(val) => setHeadData({...headData, project_id: val})}
                placeholder="Proje Ara ve Seç..."
                icon={Package}
                formatLabel={(p) => `${p.code} - ${p.name}`}
              />
            </div>

            {/* DEPO SEÇİMİ (ARANABİLİR) */}
            <div className='relative z-50'>
              <label className="block text-sm font-extrabold text-gray-800 mb-1">HANGİ DEPO?</label>
              <SearchableSelect 
                options={warehouses}
                value={headData.warehouse_id}
                onChange={(val) => setHeadData({...headData, warehouse_id: val})}
                placeholder="Depo Ara ve Seç..."
                icon={MapPin}
                formatLabel={(w) => w.name}
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 relative z-10">
             <div className="col-span-3">
                <label className="block text-sm font-extrabold text-gray-800 mb-1 flex items-center gap-2">
                  <FileText size={16} /> FİŞ NO (AUTO)
                </label>
                <input type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg bg-gray-100 font-mono font-bold text-gray-700 h-12" 
                   value={headData.document_no} 
                   onChange={(e) => setHeadData({...headData, document_no: e.target.value})} 
                />
             </div>

             <div className="col-span-3">
                <label className="block text-sm font-extrabold text-gray-800 mb-1 flex items-center gap-2">
                  <Calendar size={16} /> TARİH
                </label>
                <input type="date" className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 h-12" 
                   value={headData.document_date} 
                   onChange={(e) => setHeadData({...headData, document_date: e.target.value})} 
                />
             </div>

             <div className="col-span-6">
                <label className="block text-sm font-extrabold text-gray-800 mb-1">AÇIKLAMA</label>
                <input type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 h-12" 
                   placeholder="Örn: Haftalık üretim çıkışı..."
                   value={headData.description} 
                   onChange={(e) => setHeadData({...headData, description: e.target.value})} 
                />
             </div>
          </div>
        </div>

        {/* --- ÜRÜN EKLEME ALANI --- */}
        <div className="p-6 bg-white border-b-2 border-gray-100 relative z-20">
          <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
             <List size={20} className="text-blue-600" /> LİSTEYE ÜRÜN EKLE
          </label>
          
          <div className="flex flex-col md:flex-row gap-4 items-end bg-blue-50 p-5 rounded-xl border border-blue-200">
            
            {/* ÜRÜN SEÇİMİ (ARANABİLİR - Z-INDEX YÜKSEK) */}
            <div className="flex-grow w-full relative z-[60]">
              <span className="text-xs text-gray-600 font-bold mb-1 block">MALZEME / ÜRÜN</span>
              <SearchableSelect 
                options={stocks}
                value={newLine.stock_id}
                onChange={(val) => setNewLine({...newLine, stock_id: val})}
                placeholder="Stok Kodu veya Adı Ara..."
                formatLabel={(s) => `${s.name} (${s.stock_code})`}
              />
            </div>

            <div className="w-full md:w-32 flex-shrink-0 relative z-10">
              <span className="text-xs text-gray-600 font-bold mb-1 block">MİKTAR</span>
              <input type="number" step="0.01" className="w-full p-3 border-2 border-gray-300 rounded-lg font-bold text-center text-gray-900 h-12 text-lg focus:border-blue-600 focus:outline-none"
                placeholder="0.00"
                value={newLine.quantity} onChange={(e) => setNewLine({...newLine, quantity: e.target.value})} />
            </div>

            <button onClick={handleAddLine}
              className="h-12 w-full md:w-48 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-md flex-shrink-0 transition-colors relative z-10">
              <Plus size={24} />
              <span>LİSTEYE EKLE</span>
            </button>
          </div>
        </div>

        {/* --- LİSTE TABLOSU --- */}
        <div className="p-6 relative z-10">
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase">Ürün Kodu</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase">Ürün Adı</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 uppercase">Miktar</th>
                            <th className="px-4 py-3 text-right text-sm font-bold text-gray-700 uppercase">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {lineItems.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-4 py-10 text-center text-gray-500 italic text-lg">
                                    Henüz ürün eklenmedi.
                                </td>
                            </tr>
                        ) : (
                            lineItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 border-b last:border-0">
                                    <td className="px-4 py-3 text-sm text-gray-800 font-mono font-bold">{item.stock_code}</td>
                                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{item.stock_name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-extrabold text-center bg-gray-50">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleRemoveLine(item.id)} className="text-white bg-red-500 hover:bg-red-600 p-2 rounded-lg transition-colors">
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
    </div>
  );
};

export default Production;