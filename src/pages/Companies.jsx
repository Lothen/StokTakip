import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Pencil, Trash2, X, Save, Building2 } from 'lucide-react';

const Companies = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    id: null, 
    name: '', 
    tax_no: '', 
    tax_office: '', 
    phone: '', 
    email: '', 
    address: '' 
  });

  useEffect(() => {
    if (user) {
      getTenantAndFetchData();
    }
  }, [user]);

  const getTenantAndFetchData = async () => {
    setLoading(true);

    // A) Tenant ID'yi bul
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

    // B) Carileri çek
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', userTenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Veri çekme hatası:', error);
      alert('Veriler çekilemedi: ' + error.message);
    } else {
      setCompanies(data);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name) return alert("Firma adı zorunludur!");
    if (!tenantId) return alert("Firma bilgisi (Tenant ID) bulunamadı! Sayfayı yenileyin.");

    const companyData = {
      name: formData.name,
      tax_no: formData.tax_no,
      tax_office: formData.tax_office,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      tenant_id: tenantId
    };

    let error;

    if (formData.id) {
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', formData.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('companies')
        .insert([companyData]);
      error = insertError;
    }

    if (error) {
      alert("İşlem sırasında hata oluştu: " + error.message);
    } else {
      setIsModalOpen(false);
      getTenantAndFetchData(); 
      resetForm();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu cariyi silmek istediğinize emin misiniz?")) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);
      
      if (error) alert("Silme hatası: " + error.message);
      else getTenantAndFetchData();
    }
  };

  const openEditModal = (company) => {
    setFormData(company);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ id: null, name: '', tax_no: '', tax_office: '', phone: '', email: '', address: '' });
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_no?.includes(searchTerm)
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="text-blue-600" /> Cari Listesi
            </h1>
            <p className="text-gray-500 text-sm mt-1">Müşteri ve tedarikçi firmaların yönetimi</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={20} /> Yeni Cari Ekle
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Firma adı veya vergi no ile ara..." 
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Firma Ünvanı</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vergi Bilgileri</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">İletişim</th>
              {/* Bakiye başlığı kaldırıldı */}
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="4" className="text-center py-8 text-gray-500">Veriler yükleniyor...</td></tr>
            ) : filteredCompanies.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-8 text-gray-500">Kayıt bulunamadı.</td></tr>
            ) : (
              filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{company.name}</div>
                    <div className="text-xs text-gray-500">{company.address && company.address.substring(0, 30)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{company.tax_no || '-'}</div>
                    <div className="text-xs text-gray-500">{company.tax_office}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{company.phone || '-'}</div>
                    <div className="text-xs text-gray-500">{company.email}</div>
                  </td>
                  {/* Bakiye sütunu kaldırıldı */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(company)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => handleDelete(company.id)} className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 size={18} /></button>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{formData.id ? 'Cari Düzenle' : 'Yeni Cari Ekle'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firma Ünvanı *</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vergi No</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.tax_no}
                    onChange={(e) => setFormData({...formData, tax_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Dairesi</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.tax_office || ''}
                    onChange={(e) => setFormData({...formData, tax_office: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-Posta</label>
                  <input 
                    type="email" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                <textarea 
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2"
                >
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

export default Companies;