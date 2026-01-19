import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Save, Package, ArrowRight, Building2, Briefcase, Plus, Trash2, Calendar, Search, ChevronDown, RefreshCw, MapPin } from 'lucide-react';

// --- ÖZEL ARANABİLİR SELECT ---
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
      <div onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border-2 rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all h-12 relative z-10 ${isOpen ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-300 hover:border-gray-400'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
           {Icon && <Icon size={18} className="text-gray-500 flex-shrink-0" />}
           <span className={`truncate ${selectedItem ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
             {selectedItem ? formatLabel(selectedItem) : placeholder}
           </span>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] overflow-hidden">
          <div className="p-2 border-b bg-gray-50 sticky top-0 z-20">
             <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                <input autoFocus type="text" placeholder="Ara..." className="w-full pl-9 p-2 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </div>
          <div className="max-h-60 overflow-y-auto bg-white">
             {filteredOptions.map(opt => (
                 <div key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(''); }}
                   className={`p-3 text-sm cursor-pointer border-b last:border-0 border-gray-100 transition-colors ${value === opt.id ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-800 hover:bg-gray-100 bg-white'}`}>
                   {formatLabel(opt)}
                 </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- ANA SAYFA ---
const StockTransactions = () => {
  const { user } = useAuth();
  const { docNo } = useParams();
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  const [activeTab, setActiveTab] = useState('w2w'); 
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [headData, setHeadData] = useState({
    source_id: '', target_id: '', document_no: '', description: '',
    document_date: new Date().toISOString().split('T')[0]
  });

  const [lineItems, setLineItems] = useState([]);
  const [newLine, setNewLine] = useState({ stock_id: '', quantity: '' });

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  // --- DÜZELTME BURADA YAPILDI ---
  // Eski kodda sadece stocks.length kontrol ediliyordu.
  // Şimdi warehouses.length > 0 ve projects.length > 0 eklendi.
  // Böylece listeler dolmadan düzenleme verisi ekrana basılmıyor.
  useEffect(() => {
    if (docNo && tenantId && stocks.length > 0 && warehouses.length > 0) {
      loadTransactionForEdit(docNo);
    }
  }, [docNo, tenantId, stocks, warehouses]); 
  // --------------------------------

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (!isEditMode) {
      setHeadData(prev => ({ ...prev, source_id: '', target_id: '' }));
      setLineItems([]);
      generateDocNo(tab);
    }
  };

  const generateDocNo = (tab = activeTab) => {
    if (isEditMode) return;
    const prefixMap = { 'w2w': 'TRF', 'w2p': 'PRJ-OUT', 'p2w': 'PRJ-RET', 'p2p': 'PRJ-TRF' };
    const prefix = prefixMap[tab] || 'TRF';
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const random = Math.floor(1000 + Math.random() * 9000);
    setHeadData(prev => ({ ...prev, document_no: `${prefix}-${dateStr}-${random}` }));
  };

  const loadInitialData = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (profile) {
      setTenantId(profile.tenant_id);
      const { data: p } = await supabase.from('projects').select('id, name, code').eq('tenant_id', profile.tenant_id).eq('status', 'Devam Ediyor');
      const { data: s } = await supabase.from('stocks').select('id, name, stock_code').eq('tenant_id', profile.tenant_id);
      const { data: w } = await supabase.from('warehouses').select('id, name').eq('tenant_id', profile.tenant_id);
      setProjects(p || []); setStocks(s || []); setWarehouses(w || []);
      if (!docNo) generateDocNo('w2w');
    }
  };

  const loadTransactionForEdit = async (documentNumber) => {
    setIsEditMode(true);
    setLoading(true);

    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('document_no', documentNumber)
      .eq('tenant_id', tenantId);

    if (error || !data || data.length === 0) {
      alert("Kayıt bulunamadı!");
      navigate('/hareketler/liste');
      return;
    }

    const firstRow = data.find(d => d.direction === -1) || data[0]; 
    
    let detectedTab = 'w2w';
    let sourceId = '';
    let targetId = '';

    if (firstRow.transaction_type === 'transfer_out') {
      detectedTab = 'w2w';
      sourceId = firstRow.warehouse_id;
      // DÜZELTME: related_warehouse_id boş gelirse, diğer satırdan (giriş satırından) bulalım
      if (firstRow.related_warehouse_id) {
        targetId = firstRow.related_warehouse_id;
      } else {
        const inRow = data.find(d => d.direction === 1);
        targetId = inRow?.warehouse_id; // Giriş yapılan depo hedeftir
      }
    } else if (firstRow.transaction_type === 'production_out') {
      detectedTab = 'w2p';
      sourceId = firstRow.warehouse_id;
      targetId = firstRow.project_id;
    } else if (firstRow.transaction_type === 'production_return') {
      const inRow = data.find(d => d.direction === 1);
      detectedTab = 'p2w';
      sourceId = inRow?.project_id; 
      targetId = inRow?.warehouse_id;
    } else if (firstRow.transaction_type === 'project_transfer_out') {
      const inRow = data.find(d => d.direction === 1);
      detectedTab = 'p2p';
      sourceId = firstRow.project_id;
      targetId = inRow?.project_id;
    }

    setActiveTab(detectedTab);
    setHeadData({
      source_id: sourceId,
      target_id: targetId,
      document_no: documentNumber,
      description: firstRow.description,
      document_date: firstRow.document_date
    });

    const relevantRows = data.filter(d => d.direction === (detectedTab === 'p2w' ? 1 : -1));

    const loadedLines = relevantRows.map(row => {
      const stockInfo = stocks.find(s => s.id === row.stock_id);
      return {
        id: row.id,
        stock_id: row.stock_id,
        quantity: row.quantity,
        stock_name: stockInfo?.name,
        stock_code: stockInfo?.stock_code
      };
    });

    setLineItems(loadedLines);
    setLoading(false);
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    if (!newLine.stock_id || !newLine.quantity || Number(newLine.quantity) <= 0) return alert("Ürün ve miktar giriniz!");
    const stock = stocks.find(s => s.id === newLine.stock_id);
    setLineItems([...lineItems, { ...newLine, stock_name: stock.name, stock_code: stock.stock_code, id: Date.now() }]);
    setNewLine({ stock_id: '', quantity: '' });
  };

  const handleRemoveLine = (id) => setLineItems(prev => prev.filter(i => i.id !== id));

  const handleSaveAll = async () => {
    if (!headData.source_id || !headData.target_id) return alert("Lütfen Kaynak ve Hedef seçiniz!");
    if (headData.source_id === headData.target_id) return alert("Kaynak ve Hedef aynı olamaz!");
    if (lineItems.length === 0) return alert("Listeye ürün ekleyiniz!");

    setLoading(true);

    if (isEditMode) {
      await supabase.from('stock_transactions').delete().eq('document_no', headData.document_no);
    }

    const records = [];
    let sourceKey = 'warehouse_id';
    let targetKey = 'warehouse_id';

    if (activeTab === 'w2p') { sourceKey = 'warehouse_id'; targetKey = 'project_id'; }
    if (activeTab === 'p2w') { sourceKey = 'project_id'; targetKey = 'warehouse_id'; }
    if (activeTab === 'p2p') { sourceKey = 'project_id'; targetKey = 'project_id'; }

    lineItems.forEach(item => {
      records.push({
        tenant_id: tenantId,
        created_by: user.id,
        document_no: headData.document_no,
        document_date: headData.document_date,
        description: headData.description || (isEditMode ? 'Transfer Güncelleme' : 'Transfer Çıkışı'),
        stock_id: item.stock_id,
        quantity: item.quantity,
        direction: -1,
        transaction_type: activeTab === 'w2w' ? 'transfer_out' : activeTab === 'p2p' ? 'project_transfer_out' : 'production_out',
        warehouse_id: activeTab === 'p2p' ? null : (activeTab === 'p2w' ? null : headData.source_id),
        project_id: activeTab.startsWith('p') ? headData.source_id : null,
        related_warehouse_id: activeTab === 'w2w' ? headData.target_id : null
      });

      records.push({
        tenant_id: tenantId,
        created_by: user.id,
        document_no: headData.document_no,
        document_date: headData.document_date,
        description: headData.description || (isEditMode ? 'Transfer Güncelleme' : 'Transfer Girişi'),
        stock_id: item.stock_id,
        quantity: item.quantity,
        direction: 1,
        transaction_type: activeTab === 'w2w' ? 'transfer_in' : activeTab === 'p2p' ? 'project_transfer_in' : 'production_return',
        warehouse_id: activeTab === 'p2p' ? null : (activeTab === 'w2p' ? null : headData.target_id),
        project_id: activeTab.endsWith('p') ? headData.target_id : null,
        related_warehouse_id: activeTab === 'w2w' ? headData.source_id : null
      });
    });

    const { error } = await supabase.from('stock_transactions').insert(records);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert(isEditMode ? "Kayıt başarıyla güncellendi!" : "Transfer başarıyla tamamlandı!");
      if (isEditMode) {
        navigate('/hareketler/liste');
      } else {
        setLineItems([]);
        setHeadData(prev => ({ ...prev, source_id: '', target_id: '' }));
        generateDocNo(activeTab);
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-md border border-gray-200 sticky top-0 z-[1000]">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <ArrowRightLeft size={28} className="text-blue-600" /> 
             {isEditMode ? 'Stok Hareketi Düzenle' : 'Stok Transferleri'}
           </h1>
           <p className="text-sm text-gray-500 mt-1">
             {isEditMode ? `Fiş No: ${headData.document_no} düzenleniyor...` : 'Depo ve Projeler arası malzeme transferi'}
           </p>
        </div>
        <div className="flex items-center gap-6 ml-auto">
            <div className="text-right hidden md:block">
                <span className="block text-xs text-gray-500 font-bold uppercase">Liste Durumu</span>
                <span className="text-blue-600 font-bold text-lg">Toplam {lineItems.length} Kalem</span>
            </div>
            <button onClick={handleSaveAll} disabled={loading || lineItems.length === 0}
              className={`h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-md transition-colors min-w-[200px] ${loading || lineItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Save size={24} /> <span>{isEditMode ? 'GÜNCELLE VE KAYDET' : 'TRANSFERİ YAP'}</span>  
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 relative z-10">
        {[
          { id: 'w2w', label: 'DEPODAN DEPOYA', icon1: Building2, icon2: Building2, color: 'blue' },
          { id: 'w2p', label: 'DEPODAN PROJEYE', icon1: Building2, icon2: Briefcase, color: 'orange' },
          { id: 'p2w', label: 'PROJEDEN DEPOYA', icon1: Briefcase, icon2: Building2, color: 'indigo' },
          { id: 'p2p', label: 'PROJEDEN PROJEYE', icon1: Briefcase, icon2: Briefcase, color: 'teal' }
        ].map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)} 
            disabled={isEditMode && activeTab !== tab.id}
            className={`p-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all 
            ${activeTab === tab.id ? `bg-${tab.color}-600 text-white border-${tab.color}-700 shadow-lg scale-105` : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}
            ${isEditMode && activeTab !== tab.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="flex items-center gap-2 mb-1"><tab.icon1 size={20}/><ArrowRight size={16}/><tab.icon2 size={20}/></div>
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={`bg-white rounded-2xl shadow-xl border-2 overflow-visible relative z-20 transition-colors duration-300
        ${activeTab === 'w2w' ? 'border-blue-600' : activeTab === 'w2p' ? 'border-orange-600' : activeTab === 'p2w' ? 'border-indigo-600' : 'border-teal-600'}`}>
        
        <div className="p-6 bg-gray-50 border-b-2 border-gray-200 relative z-30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 relative z-40">
            <div className='relative z-50'>
              <label className="block text-sm font-extrabold text-gray-700 mb-2 flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center border border-red-200">1</div>
                 ÇIKIŞ YAPILACAK YER (KAYNAK)
              </label>
              <SearchableSelect 
                options={activeTab === 'w2w' || activeTab === 'w2p' ? warehouses : projects}
                value={headData.source_id}
                onChange={(val) => setHeadData({...headData, source_id: val})}
                placeholder="Seçiniz..."
                icon={activeTab.startsWith('w') ? Building2 : Briefcase}
                formatLabel={(item) => activeTab.startsWith('w') ? item.name : `${item.code} - ${item.name}`}
              />
            </div>
            <div className='relative z-50'>
              <label className="block text-sm font-extrabold text-gray-700 mb-2 flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center border border-green-200">2</div>
                 GİRİŞ YAPILACAK YER (HEDEF)
              </label>
              <SearchableSelect 
                options={activeTab === 'w2w' || activeTab === 'p2w' ? warehouses : projects}
                value={headData.target_id}
                onChange={(val) => setHeadData({...headData, target_id: val})}
                placeholder="Seçiniz..."
                icon={activeTab.endsWith('w') ? Building2 : Briefcase}
                formatLabel={(item) => activeTab.endsWith('w') ? item.name : `${item.code} - ${item.name}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10 pt-4 border-t border-gray-200">
             <div className="md:col-span-3">
                <label className="text-xs font-bold text-gray-500 mb-1 block">FİŞ NO</label>
                <input type="text" className="w-full p-2 border rounded bg-gray-100 text-sm font-mono cursor-not-allowed" 
                   value={headData.document_no} readOnly />
             </div>
             <div className="md:col-span-3">
                <label className="text-xs font-bold text-gray-500 mb-1 block">TARİH</label>
                <input type="date" className="w-full p-2 border rounded bg-white text-sm" 
                   value={headData.document_date} onChange={(e) => setHeadData({...headData, document_date: e.target.value})} />
             </div>
             <div className="md:col-span-6">
                <label className="text-xs font-bold text-gray-500 mb-1 block">AÇIKLAMA</label>
                <input type="text" className="w-full p-2 border rounded bg-white text-sm" placeholder="Transfer nedeni..."
                   value={headData.description} onChange={(e) => setHeadData({...headData, description: e.target.value})} />
             </div>
          </div>
        </div>

        <div className="p-6 bg-white border-b-2 border-gray-100 relative z-20">
          <div className="flex flex-col md:flex-row gap-4 items-end bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex-grow w-full relative z-[60]">
              <span className="text-xs text-gray-600 font-bold mb-1 block">TRANSFER EDİLECEK ÜRÜN</span>
              <SearchableSelect 
                options={stocks} value={newLine.stock_id} onChange={(val) => setNewLine({...newLine, stock_id: val})}
                placeholder="Stok Ara..." formatLabel={(s) => `${s.name} (${s.stock_code})`} icon={Package}
              />
            </div>
            <div className="w-full md:w-32 flex-shrink-0 relative z-10">
              <span className="text-xs text-gray-600 font-bold mb-1 block">MİKTAR</span>
              <input type="number" className="w-full p-3 border rounded-lg font-bold text-center h-12"
                placeholder="0.00" value={newLine.quantity} onChange={(e) => setNewLine({...newLine, quantity: e.target.value})} />
            </div>
            <button onClick={handleAddLine} className="h-12 w-full md:w-40 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow transition relative z-10">
              <Plus size={20} /> EKLE
            </button>
          </div>
        </div>

        <div className="p-6 relative z-10">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">KOD</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">ÜRÜN ADI</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">MİKTAR</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">SİL</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {lineItems.length === 0 ? (
                            <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400 text-sm">Liste boş.</td></tr>
                        ) : (
                            lineItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600">{item.stock_code}</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-800">{item.stock_name}</td>
                                    <td className="px-4 py-2 text-sm font-bold text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={() => handleRemoveLine(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
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

export default StockTransactions;