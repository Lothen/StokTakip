import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, Trash2, FileText, Building2, User, Search, ChevronDown, Coins, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom'; // useParams eklendi

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
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all h-[50px]
        ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-gray-700 w-full">
           {selectedItem ? (
             <>
               {Icon && <Icon size={18} className="text-blue-600 shrink-0"/>}
               <span className="font-bold truncate">{selectedItem.name}</span>
             </>
           ) : (
             <>
               {Icon && <Icon size={18} className="text-gray-400 shrink-0"/>}
               <span className="text-gray-400">{placeholder}</span>
             </>
           )}
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                   <div className="w-2 h-2 rounded-full bg-gray-300"></div>
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
const PurchaseInvoice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { documentNo } = useParams(); // URL parametresini al
  
  // Düzenleme modu kontrolü
  const isEditMode = !!documentNo; 

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Veri Listeleri
  const [companies, setCompanies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [currencies, setCurrencies] = useState([]); 

  // Form State
  const [header, setHeader] = useState({
    id: null, // ID eklendi (Update için gerekli)
    company_id: '',
    warehouse_id: '',
    document_type: 'Fatura',
    document_no: '',
    issue_date: new Date().toISOString().split('T')[0],
    description: '',
    currency_id: '', 
    exchange_rate: 1 
  });

  const [items, setItems] = useState([
    { stock_id: '', quantity: 1, unit_price: 0, discount_rate: 0, tax_rate: 20 }
  ]);

  const activeCurrency = currencies.find(c => c.id === header.currency_id);
  const currencySymbol = activeCurrency ? activeCurrency.symbol : '₺';

  // Sayfa Yüklenirken
  useEffect(() => {
    if (user) {
        initializePage();
    }
  }, [user, documentNo]);

  const initializePage = async () => {
      setDataLoading(true);
      await fetchDependencies();
      
      // Eğer düzenleme modundaysak, mevcut veriyi çek
      if (isEditMode) {
          await fetchInvoiceData(documentNo);
      }
      setDataLoading(false);
  };

  const fetchDependencies = async () => {
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    const tenantId = profile.tenant_id;

    // Tedarikçiler
    supabase.from('companies').select('id, name').eq('tenant_id', tenantId)
      .then(res => setCompanies(res.data || []));

    // Depolar
    supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId)
      .then(res => setWarehouses(res.data || []));

    // Stoklar ve Birimler
    supabase.from('stocks')
      .select('id, name, stock_code, units (name)') 
      .eq('tenant_id', tenantId)
      .then(res => {
         const formattedStocks = res.data?.map(s => ({
            id: s.id,
            name: s.name,
            stock_code: s.stock_code,
            unit: s.units?.name || '' 
         })) || [];
         setStockList(formattedStocks);
      });

    // Para Birimleri
    supabase.from('currencies').select('id, name, code, symbol, exchange_rate').eq('tenant_id', tenantId)
      .then(res => {
        setCurrencies(res.data || []);
        // Yeni kayıtsa ve henüz seçilmediyse varsayılanı seç
        if (!isEditMode && !header.currency_id) {
            const defaultCurr = res.data?.find(c => c.exchange_rate === 1);
            if (defaultCurr) {
                setHeader(prev => ({ ...prev, currency_id: defaultCurr.id, exchange_rate: 1 }));
            }
        }
      });
  };

  // Mevcut Fatura Verisini Çek
  const fetchInvoiceData = async (docNo) => {
      // 1. Başlığı Çek
      const { data: invoice, error } = await supabase
          .from('purchase_invoices')
          .select('*')
          .eq('document_no', docNo)
          .single();

      if (error || !invoice) {
          alert("Fatura bulunamadı!");
          return;
      }

      setHeader({
          id: invoice.id,
          company_id: invoice.company_id,
          warehouse_id: invoice.warehouse_id,
          document_type: invoice.document_type,
          document_no: invoice.document_no,
          issue_date: invoice.issue_date,
          description: invoice.description || '',
          currency_id: invoice.currency_id,
          exchange_rate: invoice.exchange_rate
      });

      // 2. Kalemleri Çek
      const { data: invoiceItems } = await supabase
          .from('purchase_invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);

      if (invoiceItems) {
          const formattedItems = invoiceItems.map(item => ({
              stock_id: item.stock_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_rate: item.discount_rate,
              tax_rate: item.tax_rate
          }));
          setItems(formattedItems.length > 0 ? formattedItems : [{ stock_id: '', quantity: 1, unit_price: 0, discount_rate: 0, tax_rate: 20 }]);
      }
  };

  const handleCurrencyChange = (currId) => {
    const selectedCurr = currencies.find(c => c.id === currId);
    setHeader({
        ...header,
        currency_id: currId,
        exchange_rate: selectedCurr ? selectedCurr.exchange_rate : 1
    });
  };

  const calculateLineTotal = (item) => {
    const gross = item.quantity * item.unit_price;
    const discountAmount = gross * (item.discount_rate / 100);
    return gross - discountAmount;
  };

  const totals = items.reduce((acc, item) => {
    const lineNet = calculateLineTotal(item);
    const taxAmount = lineNet * (item.tax_rate / 100);
    return {
      subtotal: acc.subtotal + lineNet,
      tax: acc.tax + taxAmount,
      grandTotal: acc.grandTotal + lineNet + taxAmount
    };
  }, { subtotal: 0, tax: 0, grandTotal: 0 });

  const handleAddItem = () => {
    setItems([...items, { stock_id: '', quantity: 1, unit_price: 0, discount_rate: 0, tax_rate: 20 }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!header.company_id || !header.warehouse_id || !header.document_no || !header.currency_id) {
      alert("Lütfen Tedarikçi, Depo, Belge No ve Para Birimi alanlarını doldurun.");
      return;
    }
    if (items.some(i => !i.stock_id || i.quantity <= 0)) {
        alert("Lütfen tüm satırlarda ürün seçin ve miktar girin.");
        return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

      let invoiceId = header.id;

      // Veri Hazırlama
      const invoicePayload = {
          tenant_id: profile.tenant_id,
          company_id: header.company_id,
          warehouse_id: header.warehouse_id,
          document_type: header.document_type,
          document_no: header.document_no,
          issue_date: header.issue_date,
          description: header.description,
          currency_id: header.currency_id, 
          exchange_rate: parseFloat(header.exchange_rate), 
          total_amount: totals.grandTotal,
          status: 'Onaylandı',
          created_by: user.id
      };

      if (isEditMode && invoiceId) {
          // --- GÜNCELLEME (UPDATE) ---
          const { error: updateError } = await supabase
              .from('purchase_invoices')
              .update(invoicePayload)
              .eq('id', invoiceId);
          
          if (updateError) throw updateError;

          // Kalemleri güncellemek yerine: Eskileri sil, yenileri ekle (En temiz yöntem)
          const { error: deleteError } = await supabase
              .from('purchase_invoice_items')
              .delete()
              .eq('invoice_id', invoiceId);
          
          if (deleteError) throw deleteError;

      } else {
          // --- YENİ KAYIT (INSERT) ---
          const { data: newInvoice, error: insertError } = await supabase
              .from('purchase_invoices')
              .insert(invoicePayload)
              .select()
              .single();
          
          if (insertError) throw insertError;
          invoiceId = newInvoice.id;
      }

      // Kalemleri Ekle (Her iki durumda da çalışır)
      const invoiceItems = items.map(item => ({
        tenant_id: profile.tenant_id,
        invoice_id: invoiceId,
        stock_id: item.stock_id,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        discount_rate: parseFloat(item.discount_rate),
        tax_rate: parseFloat(item.tax_rate),
        created_by: user.id
      }));

      const { error: itemsError } = await supabase.from('purchase_invoice_items').insert(invoiceItems);
      if (itemsError) throw itemsError;

      alert(isEditMode ? "Fatura başarıyla güncellendi!" : "Fatura başarıyla oluşturuldu!");
      
      // Kayıttan sonra listeye dönmek mantıklıdır
      navigate('/hareketler/liste'); 

    } catch (error) {
      console.error("Kaydetme hatası:", error);
      alert("Bir hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
      return <div className="p-10 text-center text-gray-500">Fatura verileri yükleniyor...</div>;
  }

  return (
    <div className="w-full p-6">
      
      {/* BAŞLIK */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2">
              {/* Düzenleme modundaysa geri butonu göster */}
              {isEditMode && (
                  <button onClick={() => navigate('/hareketler/liste')} className="p-2 hover:bg-gray-100 rounded-full transition">
                      <ArrowLeft size={24} className="text-gray-600"/>
                  </button>
              )}
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FileText size={28} className="text-blue-600" /> 
                {isEditMode ? 'Faturayı Düzenle' : 'Yeni Satınalma Girişi'}
              </h1>
          </div>
          <p className="text-sm text-gray-500 ml-10">
              {isEditMode ? `${header.document_no} nolu belgeyi düzenliyorsunuz.` : 'Tedarikçiden gelen Fatura veya İrsaliyeyi sisteme işleyin.'}
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
        >
          <Save size={20} /> {loading ? 'İşleniyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
        </button>
      </div>

      {/* --- FORM KISMI --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 w-full">
        
        {/* ÜST SATIR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="md:col-span-1 relative z-30"> 
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tedarikçi</label>
            <SearchableSelect options={companies} value={header.company_id} onChange={(val) => setHeader({...header, company_id: val})} placeholder="Firma Ara..." icon={User} />
          </div>
          <div className="md:col-span-1 relative z-30">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Depo</label>
            <SearchableSelect options={warehouses} value={header.warehouse_id} onChange={(val) => setHeader({...header, warehouse_id: val})} placeholder="Depo Seç..." icon={Building2} />
          </div>
          <div className="md:col-span-1">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Belge No</label>
             <input 
                type="text" 
                placeholder="Örn: GIB2026..." 
                className={`w-full p-3 border border-gray-300 rounded-lg outline-none font-mono h-[50px] ${isEditMode ? 'bg-gray-100 text-gray-500' : ''}`}
                value={header.document_no} 
                onChange={e => setHeader({...header, document_no: e.target.value})} 
                disabled={isEditMode} // Düzenleme modunda belge no değişmesin
             />
          </div>
          <div className="md:col-span-1">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tarih</label>
             <input type="date" className="w-full p-3 border border-gray-300 rounded-lg outline-none h-[50px]" value={header.issue_date} onChange={e => setHeader({...header, issue_date: e.target.value})} />
          </div>
        </div>

        {/* ALT SATIR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t pt-4 border-gray-100">
            <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <Coins size={14} className="text-orange-500"/> Para Birimi
                </label>
                <div className="relative">
                    <select 
                        className="w-full p-3 pl-10 border border-orange-200 bg-orange-50 rounded-lg font-bold text-gray-700 outline-none h-[50px] appearance-none"
                        value={header.currency_id}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                    >
                        <option value="">Seçiniz...</option>
                        {currencies.map(c => (
                            <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-gray-400" size={16}/>
                    <span className="absolute left-3 top-3.5 text-orange-600 font-bold">{currencySymbol}</span>
                </div>
            </div>

            <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                    <RefreshCw size={14} className="text-blue-500"/> İşlem Kuru
                </label>
                <input 
                    type="number" step="0.0001"
                    className="w-full p-3 border border-gray-300 rounded-lg font-mono font-bold text-right outline-none h-[50px] focus:ring-2 focus:ring-blue-500"
                    value={header.exchange_rate}
                    onChange={e => setHeader({...header, exchange_rate: e.target.value})}
                />
            </div>

             <div className="md:col-span-1">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tip</label>
               <select className="w-full p-3 border border-gray-300 rounded-lg outline-none h-[50px] bg-white"
                 value={header.document_type} onChange={e => setHeader({...header, document_type: e.target.value})}
               >
                 <option>Fatura</option>
                 <option>İrsaliye</option>
               </select>
            </div>
            
            <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Açıklama</label>
                <input type="text" placeholder="Genel açıklama..." className="w-full p-3 border border-gray-300 rounded-lg outline-none h-[50px]" value={header.description} onChange={e => setHeader({...header, description: e.target.value})} />
            </div>
        </div>
      </div>

      {/* --- SATIRLAR --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-20 w-full">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[30%]">Ürün</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[15%]">Miktar</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[15%]">
                Birim Fiyat <span className="text-orange-600">({currencySymbol})</span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-purple-600 uppercase w-[10%]">İskonto %</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-[10%]">KDV %</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase w-[15%]">Ara Toplam</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => {
              // Seçili stok birimini bul
              const currentStock = stockList.find(s => s.id === item.stock_id);
              const unitName = currentStock ? currentStock.unit : '';

              return (
                <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-2 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                    
                    <td className="px-4 py-2">
                        <select className="w-full p-2 border border-gray-300 rounded bg-white text-sm outline-none" value={item.stock_id} onChange={e => handleItemChange(index, 'stock_id', e.target.value)}>
                            <option value="">Ürün Seçiniz...</option>
                            {stockList.map(s => <option key={s.id} value={s.id}>{s.stock_code} - {s.name}</option>)}
                        </select>
                    </td>

                    {/* MİKTAR VE BİRİM YAN YANA */}
                    <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                            <input type="number" min="1" className="w-full p-2 border border-gray-300 rounded text-center font-bold text-gray-700 outline-none focus:border-blue-500" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                            <span className="text-xs text-gray-500 font-bold whitespace-nowrap min-w-[30px]">{unitName}</span>
                        </div>
                    </td>

                    <td className="px-4 py-2">
                        <div className="relative">
                            <input type="number" min="0" step="0.01" className="w-full p-2 pl-6 border border-gray-300 rounded text-right font-mono outline-none" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                            <span className="absolute left-2 top-2 text-gray-400 text-xs font-bold">{currencySymbol}</span>
                        </div>
                    </td>
                    <td className="px-4 py-2"><input type="number" min="0" max="100" className="w-full p-2 border border-purple-200 bg-purple-50 rounded text-center font-bold text-purple-700 outline-none" value={item.discount_rate} onChange={e => handleItemChange(index, 'discount_rate', e.target.value)} /></td>
                    <td className="px-4 py-2">
                        <select className="w-full p-2 border border-gray-300 rounded text-center text-sm outline-none" value={item.tax_rate} onChange={e => handleItemChange(index, 'tax_rate', e.target.value)}>
                            <option value="0">%0</option>
                            <option value="1">%1</option>
                            <option value="10">%10</option>
                            <option value="20">%20</option>
                        </select>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-800">
                        {calculateLineTotal(item).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currencySymbol}
                    </td>
                    <td className="px-4 py-2 text-center">
                        <button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                    </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button onClick={handleAddItem} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-800"><Plus size={18} /> Yeni Satır Ekle</button>
        </div>
      </div>

      {/* --- ALT TOPLAMLAR --- */}
      <div className="fixed bottom-0 right-0 w-full bg-white border-t border-gray-200 p-4 shadow-2xl z-50 flex justify-end items-center gap-8 pr-10">
         <div className="text-right">
            <div className="text-xs text-gray-500 font-bold uppercase">Ara Toplam (Net)</div>
            <div className="text-lg font-medium text-gray-700">{totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currencySymbol}</div>
         </div>
         <div className="text-right">
            <div className="text-xs text-gray-500 font-bold uppercase">Toplam KDV</div>
            <div className="text-lg font-medium text-gray-700">{totals.tax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currencySymbol}</div>
         </div>
         <div className="text-right border-l pl-8 border-gray-300">
            <div className="text-xs text-blue-600 font-bold uppercase">Genel Toplam</div>
            <div className="text-3xl font-bold text-blue-800">{totals.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {currencySymbol}</div>
         </div>
      </div>

    </div>
  );
};

export default PurchaseInvoice;