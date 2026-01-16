import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Pencil, Trash2, X, Save, Warehouse, MapPin, Phone, Info } from 'lucide-react';

const Warehouses = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(null);
  
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseTypes, setWarehouseTypes] = useState([]); // Depo tiplerini tutacak
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ 
    id: null, 
    code: '', 
    name: '', 
    type_id: '', 
    address: '', 
    city: '',
    phone: '',
    is_active: true 
  });

  useEffect(() => {
    if (user) {
      fetchWarehouseTypes();
      getTenantAndFetchData();
    }
  }, [user]);

  // 1. Depo Tiplerini SQL verisine uygun şekilde çekiyoruz
  const fetchWarehouseTypes = async () => {
    const { data, error } = await supabase
      .from('warehouse_types')
      .select('*')
      .order('id', { ascending: true }); // ID 1 (Merkez) en üstte olsun
    
    if (!error && data) {
      setWarehouseTypes(data);
      // Varsayılan olarak ilk tipi (Genelde Merkez Depo) seç
      if (data.length > 0 && !formData.type_id) {
        setFormData(prev => ({ ...prev, type_id: data[0].id }));
      }
    }
  };

  const getTenantAndFetchData = async () => {
    setLoading(true);
    // A) Profil'den Tenant ID al
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    
    if (profile) {
      setTenantId(profile.tenant_id);
      
      // B) Depoları çek (warehouse_types tablosuyla birleştirerek)
      const { data, error } = await supabase
        .from('warehouses')
        .select(`
          *,
          warehouse_types ( name, code, is_virtual ) 
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        alert("Veri çekme hatası: " + error.message);
      } else {
        setWarehouses(data || []);
      }
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert("Depo adı zorunludur!");
    if (!formData.code) return alert("Depo kodu zorunludur!");
    if (!tenantId) return alert("Firma bilgisi (Tenant) bulunamadı!");

    const dataToSend = { 
      code: formData.code,
      name: formData.name,
      type_id: formData.type_id || null, 
      address: formData.address,
      city: formData.city,
      phone: formData.phone,
      is_active: formData.is_active,
      tenant_id: tenantId 
    };

    let error;
    if (formData.id) {
      // Güncelleme
      const { error: err } = await supabase
        .from('warehouses')
        .update(dataToSend)
        .eq('id', formData.id);
      error = err;
    } else {
      // Ekleme
      const { error: err } = await supabase
        .from('warehouses')
        .insert([dataToSend]);
      error = err;
    }

    if (error) {
      if (error.code === '23505') {
        alert("Bu Depo Kodu sistemde zaten kayıtlı!");
      } else {
        alert("Hata: " + error.message);
      }
    } else {
      setIsModalOpen(false);
      getTenantAndFetchData();
      resetForm();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu depoyu silmek istediğinize emin misiniz?")) {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (!error) getTenantAndFetchData();
      else alert("Silme hatası: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({ 
      id: null, 
      code: '', 
      name: '', 
      // Listeyi sıfırlarken yine ilk seçeneği (Merkez Depo) varsayılan yapalım
      type_id: warehouseTypes.length > 0 ? warehouseTypes[0].id : '', 
      address: '', 
      city: '', 
      phone: '', 
      is_active: true 
    });
  };

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Warehouse className="text-blue-600" /> Depo Listesi
            </h1>
            <p className="text-gray-500 text-sm mt-1">Fiziksel ve sanal depolama alanları</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={20} /> Yeni Depo
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Depo adı veya kodu ile ara..." 
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kod & İsim</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tip</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Konum</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Durum</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="5" className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : filteredWarehouses.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-8 text-gray-500">Kayıt bulunamadı.</td></tr>
            ) : (
              filteredWarehouses.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{w.code}</div>
                    <div className="font-medium text-gray-700">{w.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-100">
                        {w.warehouse_types?.name || 'Belirsiz'}
                      </span>
                      {/* Sanal Depo İse Göster */}
                      {w.warehouse_types?.is_virtual && (
                         <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Info size={10} /> Sanal Depo
                         </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-xs text-gray-600 mb-1">
                        <MapPin size={12} className="mr-1" /> {w.city || '-'}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                        <Phone size={12} className="mr-1" /> {w.phone || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {w.is_active ? (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">Aktif</span>
                    ) : (
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">Pasif</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => { setFormData(w); setIsModalOpen(true); }} className="text-blue-600 p-2 hover:bg-blue-50 rounded"><Pencil size={18} /></button>
                    <button onClick={() => handleDelete(w.id)} className="text-red-600 p-2 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{formData.id ? 'Depo Düzenle' : 'Yeni Depo Ekle'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Depo Kodu *</label>
                    <input type="text" required className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Depo Tipi</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={formData.type_id} onChange={e => setFormData({...formData, type_id: e.target.value})}>
                        <option value="">Seçiniz</option>
                        {warehouseTypes.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.code})
                            </option>
                        ))}
                    </select>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depo Adı *</label>
                <input type="text" required className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                <textarea rows="2" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" className="w-4 h-4 text-blue-600 rounded" 
                    checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                <label htmlFor="isActive" className="text-sm text-gray-700">Bu depo aktif olarak kullanılıyor mu?</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouses;