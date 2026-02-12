import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, Trash2, Package, Building2, Search, ChevronDown, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- ARAMALI SEÇİM KUTUSU (Değişmedi) ---
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
    (opt.stock_code && opt.stock_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all h-[42px]
        ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-gray-700 w-full">
           {selectedItem ? (
             <>
               {Icon && <Icon size={16} className="text-blue-600 shrink-0"/>}
               <span className="font-bold truncate text-sm">{selectedItem.stock_code ? `${selectedItem.stock_code} - ` : ''}{selectedItem.name}</span>
             </>
           ) : (
             <>
               {Icon && <Icon size={16} className="text-gray-400 shrink-0"/>}
               <span className="text-gray-400 text-sm">{placeholder}</span>
             </>
           )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[500] overflow-hidden">
          <div className="p-2 border-b bg-gray-50 sticky top-0">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Ara..." 
                  className="w-full pl-8 p-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500"
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
                   className={`p-2 text-sm cursor-pointer border-b last:border-0 border-gray-100 transition-colors flex items-center gap-2
                   ${value === opt.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                 >
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

const StockEntry = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // URL parametrelerini oku
  
  // URL'den docNo parametresini al
  const docNoParam = searchParams.get('docNo');
  const isEditMode = !!docNoParam;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Veri Listeleri
  const [warehouses, setWarehouses] = useState([]);
  const [stockList, setStockList] = useState([]);

  // Form Başlığı
  const [header, setHeader] = useState({
    warehouse_id: '',
    document_no: `GIRIS-${new Date().getFullYear()}${Math.floor(Math.random() * 1000)}`,
    document_date: new Date().toISOString().split('T')[0],
    description: 'Açılış / Devir Sayımı'
  });

  // Satırlar
  const [items, setItems] = useState([
    { stock_id: '', quantity: 1, price: 0 }
  ]);

  // Sayfa Yüklendiğinde
  useEffect(() => {
    if (user) {
        initializePage();
    }
  }, [user, docNoParam]);

  const initializePage = async () => {
      setDataLoading(true);
      await fetchDependencies();
      
      // Eğer düzenleme modundaysak verileri çek
      if (isEditMode) {
          await fetchEntryDetails(docNoParam);
      }
      setDataLoading(false);
  };

  const fetchDependencies = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    const tenantId = profile.tenant_id;

    // Depoları Çek
    const { data: wh } = await supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId);
    setWarehouses(wh || []);

    // Stokları Çek
    const { data: stocks } = await supabase.from('stocks').select('id, name, stock_code, units(name)').eq('tenant_id', tenantId);
    
    // Stokları formatla
    const formattedStocks = stocks?.map(s => ({
        id: s.id,
        name: s.name,
        stock_code: s.stock_code,
        unit_name: s.units?.name || ''
    })) || [];
    setStockList(formattedStocks);
  };

  // MEVCUT VERİLERİ ÇEKME (DÜZENLEME İÇİN)
  const fetchEntryDetails = async (docNo) => {
      // Belge Numarasına göre hareketleri çek
      const { data: transactions, error } = await supabase
          .from('stock_transactions')
          .select('*')
          .eq('document_no', docNo);

      if (error || !transactions || transactions.length === 0) {
          alert('Kayıt bulunamadı!');
          return;
      }

      // İlk kayıttan başlık bilgilerini al
      const firstRecord = transactions[0];
      setHeader({
          warehouse_id: firstRecord.warehouse_id,
          document_no: firstRecord.document_no,
          document_date: firstRecord.document_date,
          description: firstRecord.description || ''
      });

      // Satırları oluştur
      const formattedItems = transactions.map(t => ({
          stock_id: t.stock_id,
          // Veritabanında (Miktar * Yön) ayrıdır. Input için bunları tekrar birleştiriyoruz (+/-)
          // Örn: DB'de miktar=5, yön=-1 ise inputta -5 göstermeliyiz.
          quantity: t.quantity * t.direction, 
          price: t.price
      }));

      setItems(formattedItems);
  };

  const handleAddItem = () => {
    setItems([...items, { stock_id: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!header.warehouse_id) return alert("Lütfen Depo seçiniz.");
    
    if (items.some(i => !i.stock_id || parseFloat(i.quantity) === 0)) {
        return alert("Lütfen tüm satırlara ürün seçin ve miktarın 0 olmadığından emin olun.");
    }

    setLoading(true);
    try {
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
        const tenantId = profile.tenant_id;

        // DÜZENLEME MODU İSE: Önce eski kayıtları sil
        if (isEditMode) {
            const { error: deleteError } = await supabase
                .from('stock_transactions')
                .delete()
                .eq('document_no', docNoParam); // URL'den gelen orijinal belge no ile sil
            
            if (deleteError) throw deleteError;
        }

        // YENİ KAYITLARI OLUŞTUR (INSERT)
        const transactions = items.map(item => {
            const qty = parseFloat(item.quantity);
            const finalQuantity = Math.abs(qty); // Mutlak değer (Pozitif)
            const finalDirection = qty >= 0 ? 1 : -1; // Yön (-1 veya 1)

            return {
                tenant_id: tenantId,
                warehouse_id: header.warehouse_id,
                stock_id: item.stock_id,
                quantity: finalQuantity, 
                price: parseFloat(item.price), 
                direction: finalDirection,
                transaction_type: 'stock_in', 
                document_no: header.document_no,
                document_date: header.document_date,
                description: header.description,
                created_by: user.id
            };
        });

        const { error } = await supabase.from('stock_transactions').insert(transactions);

        if (error) throw error;

        alert(isEditMode ? "Güncelleme başarılı!" : "Giriş başarılı!");
        
        // İşlem bitince listeye dön veya formu temizle
        if (isEditMode) {
            navigate('/hareketler/liste');
        } else {
            setItems([{ stock_id: '', quantity: 1, price: 0 }]);
            setHeader(prev => ({...prev, document_no: `GIRIS-${new Date().getFullYear()}${Math.floor(Math.random() * 1000)}`}));
        }
        
    } catch (error) {
        console.error("Hata:", error);
        alert("İşlem başarısız: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  if (dataLoading) {
      return <div className="p-10 text-center text-gray-500">Veriler yükleniyor...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
              {isEditMode && (
                  <button onClick={() => navigate('/hareketler/liste')} className="p-2 hover:bg-gray-100 rounded-full transition">
                      <ArrowLeft size={24} className="text-gray-600"/>
                  </button>
              )}
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package size={28} className="text-green-600" /> 
                {isEditMode ? 'Stok Girişini Düzenle' : 'Hızlı Stok Giriş Fişi'}
              </h1>
          </div>
          <p className="text-sm text-gray-500 ml-10">
              {isEditMode ? `${header.document_no} nolu fişi düzenliyorsunuz.` : 'Açılış bakiyeleri, devir veya düzeltme (-/+) işlemleri için'}
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
        >
          <Save size={20} /> {loading ? 'İşleniyor...' : (isEditMode ? 'Güncelle' : 'Fişi Kaydet')}
        </button>
      </div>

      {/* --- BAŞLIK BİLGİLERİ --- */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">İşlem Yapılacak Depo</label>
                <SearchableSelect 
                    options={warehouses} 
                    value={header.warehouse_id} 
                    onChange={(val) => setHeader({...header, warehouse_id: val})} 
                    placeholder="Depo Seçiniz..." 
                    icon={Building2} 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fiş Tarihi</label>
                <div className="relative">
                    <input 
                        type="date" 
                        className="w-full p-2.5 pl-9 border border-gray-300 rounded-lg outline-none focus:border-green-500"
                        value={header.document_date}
                        onChange={(e) => setHeader({...header, document_date: e.target.value})}
                    />
                    <Calendar size={16} className="absolute left-3 top-3 text-gray-400"/>
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Belge No / Açıklama</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className={`w-1/3 p-2.5 border border-gray-300 rounded-lg outline-none font-mono text-sm ${isEditMode ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-600'}`}
                        value={header.document_no}
                        onChange={(e) => setHeader({...header, document_no: e.target.value})}
                        placeholder="Belge No"
                        disabled={isEditMode} // Düzenleme modunda Belge No değişmesin
                    />
                     <input 
                        type="text" 
                        className="w-2/3 p-2.5 border border-gray-300 rounded-lg outline-none focus:border-green-500 text-sm"
                        value={header.description}
                        onChange={(e) => setHeader({...header, description: e.target.value})}
                        placeholder="Açıklama"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* --- SATIRLAR --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-visible">
        <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[40%]">Ürün</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[20%]">Miktar (+/-)</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[20%]">Birim Maliyet (Opsiyonel)</th>
                    <th className="px-4 py-3 w-10"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                    const selectedStock = stockList.find(s => s.id === item.stock_id);
                    return (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-center text-gray-400 text-xs">{index + 1}</td>
                            <td className="px-4 py-2">
                                <SearchableSelect 
                                    options={stockList} 
                                    value={item.stock_id} 
                                    onChange={(val) => handleItemChange(index, 'stock_id', val)} 
                                    placeholder="Ürün Ara..." 
                                />
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" step="0.01"
                                        className={`w-full p-2 border rounded text-center font-bold outline-none 
                                            ${item.quantity < 0 ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-300 text-gray-700 focus:border-green-500'}`}
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                    />
                                    <span className="text-xs text-gray-500 font-bold w-10 truncate">
                                        {selectedStock ? selectedStock.unit_name : ''}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <input 
                                    type="number" min="0" step="0.01"
                                    className="w-full p-2 border border-gray-300 rounded text-right font-mono outline-none focus:border-green-500"
                                    placeholder="0.00"
                                    value={item.price}
                                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                />
                            </td>
                            <td className="px-4 py-2 text-center">
                                <button onClick={() => handleRemoveItem(index)} className="text-gray-300 hover:text-red-500 transition">
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        <div className="p-3 bg-gray-50 border-t border-gray-200">
            <button onClick={handleAddItem} className="flex items-center gap-1 text-sm font-bold text-green-600 hover:text-green-800">
                <Plus size={18} /> Yeni Satır Ekle
            </button>
        </div>
      </div>

    </div>
  );
};

export default StockEntry;