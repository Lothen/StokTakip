import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Pencil, Trash2, X, Save, Package, Tag } from 'lucide-react';

const Stocks = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(null);

  const [stocks, setStocks] = useState([]);
  const [units, setUnits] = useState([]); // Birimleri tutacak state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal ve Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    id: null, 
    stock_code: '', 
    manufacturer_code: '', // YENİ ALAN: Üretici Kodu
    name: '', 
    second_name: '',
    description: '',
    unit_id: '', 
    buying_price: 0, 
    buying_currency_code: 'TRY',
    selling_price: 0,
    selling_currency_code: 'TRY',
    vat_rate: 20
  });

  const currencies = ['TRY', 'USD', 'EUR', 'GBP'];

  useEffect(() => {
    if (user) {
      fetchUnits();
      getTenantAndFetchStocks();
    }
  }, [user]);

  // 1. Birimleri (Units) Çeken Fonksiyon
  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Birimler çekilemedi:', error);
    } else {
      setUnits(data);
      // Eğer form boşsa ve birimler geldiyse, varsayılan olarak ilkini seç
      if (data.length > 0 && !formData.unit_id) {
        setFormData(prev => ({ ...prev, unit_id: data[0].id }));
      }
    }
  };

  // 2. Kullanıcının Firmasını ve Stoklarını Çeken Fonksiyon
  const getTenantAndFetchStocks = async () => {
    setLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profil hatası:', profileError);
      setLoading(false);
      return;
    }

    const userTenantId = profileData.tenant_id;
    setTenantId(userTenantId);

    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('tenant_id', userTenantId)
      .order('created_at', { ascending: false });

    if (error) {
      alert('Stoklar çekilemedi: ' + error.message);
    } else {
      setStocks(data);
    }
    setLoading(false);
  };

  // 3. KAYDETME İŞLEMİ (Hata Yakalama Eklenmiş Hali)
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name) return alert("Stok adı zorunludur!");
    if (!formData.stock_code) return alert("Stok kodu zorunludur!");
    if (!formData.unit_id) return alert("Lütfen bir birim seçiniz!");
    if (!tenantId) return alert("Firma bilgisi bulunamadı!");

    const stockData = {
      stock_code: formData.stock_code,
      manufacturer_code: formData.manufacturer_code, // YENİ ALAN EKLENDİ
      name: formData.name,
      second_name: formData.second_name,
      description: formData.description,
      unit_id: formData.unit_id,
      buying_price: formData.buying_price,
      buying_currency_code: formData.buying_currency_code,
      selling_price: formData.selling_price,
      selling_currency_code: formData.selling_currency_code,
      vat_rate: formData.vat_rate,
      tenant_id: tenantId
    };

    let error;

    if (formData.id) {
      // Güncelleme
      const { error: updateError } = await supabase
        .from('stocks')
        .update(stockData)
        .eq('id', formData.id);
      error = updateError;
    } else {
      // Yeni Ekleme
      const { error: insertError } = await supabase
        .from('stocks')
        .insert([stockData]);
      error = insertError;
    }

    if (error) {
      // ÖZEL HATA KONTROLÜ: Aynı Stok Kodu (Unique Constraint)
      if (error.code === '23505') {
        alert(`Bu Stok Kodu (${formData.stock_code}) sistemde zaten kayıtlı! Lütfen farklı bir kod girin.`);
      } else {
        alert("Beklenmedik bir hata oluştu: " + error.message);
      }
    } else {
      setIsModalOpen(false);
      getTenantAndFetchStocks();
      // Başarılı olursa formu sıfırla (varsayılan birimi koruyarak)
      resetForm(units.length > 0 ? units[0].id : '');
    }
  };

  // 4. Silme İşlemi
  const handleDelete = async (id) => {
    if (window.confirm("Bu stoğu silmek istediğinize emin misiniz?")) {
      const { error } = await supabase.from('stocks').delete().eq('id', id);
      if (error) alert("Silme hatası: " + error.message);
      else getTenantAndFetchStocks();
    }
  };

  const openEditModal = (stock) => {
    setFormData({
        ...stock,
        manufacturer_code: stock.manufacturer_code || '' // Null gelirse boş string yap
    });
    setIsModalOpen(true);
  };

  const resetForm = (defaultUnitId = '') => {
    // Eğer birim ID parametre olarak gelmediyse, mevcut listeden ilkini seçmeye çalış
    const validUnitId = defaultUnitId || (units.length > 0 ? units[0].id : '');
    
    setFormData({ 
      id: null, 
      stock_code: '', 
      manufacturer_code: '', // Sıfırla
      name: '', 
      second_name: '',
      description: '',
      unit_id: validUnitId,
      buying_price: 0, 
      buying_currency_code: 'TRY',
      selling_price: 0,
      selling_currency_code: 'TRY',
      vat_rate: 20
    });
  };

  // Birim ID'sinden ismini bulan yardımcı fonksiyon
  const getUnitName = (id) => {
    const unit = units.find(u => u.id == id);
    return unit ? unit.name : '...';
  };

  const filteredStocks = stocks.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.stock_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.manufacturer_code?.toLowerCase().includes(searchTerm.toLowerCase()) // Üretici kodunda da arama yap
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-blue-600" /> Stok Listesi
            </h1>
            <p className="text-gray-500 text-sm mt-1">Ürün ve hizmet yönetimi</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={20} /> Yeni Stok Ekle
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Stok adı, kodu veya üretici kodu ile ara..." 
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kod & İsim</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Birim</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Alış Fiyatı</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Satış Fiyatı</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">KDV</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : filteredStocks.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-500">Stok bulunamadı.</td></tr>
            ) : (
              filteredStocks.map((stock) => (
                <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{stock.stock_code}</div>
                    {/* Üretici Kodu Gösterimi */}
                    {stock.manufacturer_code && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Tag size={10} /> Üretici: {stock.manufacturer_code}
                        </div>
                    )}
                    <div className="text-sm text-gray-700 mt-1">{stock.name}</div>
                    {stock.second_name && <div className="text-xs text-gray-400">{stock.second_name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded border border-gray-200">
                      {getUnitName(stock.unit_id)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {stock.buying_price} <span className="text-xs font-bold">{stock.buying_currency_code}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {stock.selling_price} <span className="text-xs font-bold">{stock.selling_currency_code}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    %{stock.vat_rate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(stock)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Pencil size={18} /></button>
                        <button onClick={() => handleDelete(stock.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{formData.id ? 'Stok Düzenle' : 'Yeni Stok Ekle'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              {/* Stok Kodu, Üretici Kodu ve Birim Alanı */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Kodu *</label>
                  <input 
                    type="text" required
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stock_code}
                    onChange={(e) => setFormData({...formData, stock_code: e.target.value})}
                  />
                </div>
                <div>
                  {/* YENİ: Üretici Kodu Input */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">Üretici Kodu</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.manufacturer_code}
                    placeholder="Opsiyonel"
                    onChange={(e) => setFormData({...formData, manufacturer_code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Birim *</label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={formData.unit_id}
                    onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                  >
                    <option value="" disabled>Seçiniz</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Adı *</label>
                  <input 
                    type="text" required
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İkinci İsim</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.second_name}
                    onChange={(e) => setFormData({...formData, second_name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea 
                  rows="2"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alış Fiyatı</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.buying_price}
                    onChange={(e) => setFormData({...formData, buying_price: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Para Birimi</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={formData.buying_currency_code}
                      onChange={(e) => setFormData({...formData, buying_currency_code: e.target.value})}
                    >
                      {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">KDV Oranı (%)</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({...formData, vat_rate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satış Fiyatı</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  />
                </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Para Birimi</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={formData.selling_currency_code}
                      onChange={(e) => setFormData({...formData, selling_currency_code: e.target.value})}
                    >
                      {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">İptal</button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Save size={18} /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;