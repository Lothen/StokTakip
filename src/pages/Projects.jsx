import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Pencil, Trash2, X, Save, FolderKanban, Calendar, Briefcase, GitMerge, ChevronDown, Filter } from 'lucide-react';

const Projects = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(null);

  // --- Veri State'leri ---
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- Filtreleme State'leri ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('HEPSI'); // Varsayılan: Hepsi

  // --- Modal ve Form State'leri ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    id: null, 
    code: '', 
    name: '', 
    customer_id: '', 
    parent_id: '', 
    status: 'Devam Ediyor',
    start_date: '',
    end_date: '',
    description: ''
  });

  const statusOptions = ['Planlanan', 'Devam Ediyor', 'Tamamlandı', 'İptal Edildi'];

  // --- Akıllı Dropdown State'leri (Üst Proje) ---
  const [parentSearch, setParentSearch] = useState('');
  const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
  const parentDropdownRef = useRef(null);

  // --- Akıllı Dropdown State'leri (Müşteri) ---
  const [customerSearch, setCustomerSearch] = useState(''); // Müşteri arama metni
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  // Dışarı tıklamaları algılayıp dropdownları kapatma
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
        setIsParentDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    
    if (profile) {
      setTenantId(profile.tenant_id);

      // 1. Müşterileri Çek
      const { data: custData } = await supabase.from('companies').select('id, name').eq('tenant_id', profile.tenant_id);
      setCustomers(custData || []);

      // 2. Projeleri Çek
      const { data: projData, error } = await supabase
        .from('projects')
        .select(`*, companies ( name )`)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) alert("Hata: " + error.message);
      else setProjects(projData || []);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.code) return alert("Proje Kodu zorunludur!");
    if (!formData.name) return alert("Proje Adı zorunludur!");
    if (!tenantId) return alert("Firma bilgisi bulunamadı!");

    const dataToSend = {
      code: formData.code,
      name: formData.name,
      customer_id: formData.customer_id || null,
      parent_id: formData.parent_id || null,
      status: formData.status,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description,
      tenant_id: tenantId
    };

    let error;
    if (formData.id) {
      const { error: err } = await supabase.from('projects').update(dataToSend).eq('id', formData.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('projects').insert([dataToSend]);
      error = err;
    }

    if (error) {
      alert("Hata: " + error.message);
    } else {
      setIsModalOpen(false);
      loadInitialData(); 
      resetForm();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu projeyi silmek istediğinize emin misiniz?")) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) loadInitialData();
      else alert("Silme hatası: " + error.message);
    }
  };

  const openEditModal = (proj) => {
    setFormData(proj);
    
    // Üst Proje İsmini Bul ve Yaz
    if (proj.parent_id) {
      const parentName = getProjectName(proj.parent_id);
      setParentSearch(parentName);
    } else {
      setParentSearch('');
    }

    // Müşteri İsmini Bul ve Yaz
    if (proj.customer_id) {
      const customerName = getCustomerName(proj.customer_id);
      setCustomerSearch(customerName);
    } else {
      setCustomerSearch('');
    }

    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      id: null, code: '', name: '', customer_id: '', parent_id: '',
      status: 'Devam Ediyor', start_date: '', end_date: '', description: '' 
    });
    setParentSearch('');
    setCustomerSearch('');
  };

  // Yardımcı Fonksiyonlar
  const getProjectName = (id) => {
    const p = projects.find(x => x.id === id);
    return p ? p.name : '';
  };

  const getCustomerName = (id) => {
    const c = customers.find(x => x.id === id);
    return c ? c.name : '';
  };

  // --- FİLTRELEME MANTIKLARI ---

  // 1. Dropdown Listeleri için Filtreler
  const eligibleParents = projects.filter(p => 
    p.id !== formData.id && 
    p.status === 'Devam Ediyor' && 
    (p.name.toLowerCase().includes(parentSearch.toLowerCase()) || p.code.toLowerCase().includes(parentSearch.toLowerCase()))
  );

  const eligibleCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // 2. Ana Liste Filtrelemesi (Arama + Durum Filtresi)
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'HEPSI' || p.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FolderKanban className="text-blue-600" /> Proje Yönetimi
            </h1>
            <p className="text-gray-500 text-sm mt-1">Müşteri projeleri ve hiyerarşik iş takibi</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
        >
          <Plus size={20} /> Yeni Proje
        </button>
      </div>

      {/* --- FİLTRELEME ALANI (Arama + Durum Seçimi) --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Metin Arama */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Proje adı veya kodu ile ara..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Durum Filtresi Dropdown */}
        <div className="relative min-w-[200px]">
          <div className="absolute left-3 top-3 text-gray-500 pointer-events-none">
            <Filter size={18} />
          </div>
          <select 
            className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="HEPSI">Tüm Durumlar</option>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="absolute right-3 top-3 text-gray-500 pointer-events-none">
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kod & İsim</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Üst Proje</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Müşteri</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Durum</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tarihler</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : filteredProjects.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-500">Kayıt bulunamadı.</td></tr>
            ) : (
              filteredProjects.map((proj) => (
                <tr key={proj.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{proj.code}</div>
                    <div className="font-medium text-gray-700">{proj.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    {proj.parent_id ? (
                      <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit">
                        <GitMerge size={14} />
                        {getProjectName(proj.parent_id)}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Ana Proje</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Briefcase size={14} className="text-gray-400"/>
                      {proj.companies?.name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold 
                      ${proj.status === 'Tamamlandı' ? 'bg-green-100 text-green-800' : 
                        proj.status === 'İptal Edildi' ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800'}`}>
                      {proj.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                     <div className="flex items-center gap-1 mb-1">
                        <Calendar size={12} /> Baş: {proj.start_date || '-'}
                     </div>
                     <div className="flex items-center gap-1">
                        <Calendar size={12} /> Bit: {proj.end_date || '-'}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => openEditModal(proj)} className="text-blue-600 p-2 hover:bg-blue-50 rounded"><Pencil size={18} /></button>
                    <button onClick={() => handleDelete(proj.id)} className="text-red-600 p-2 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">{formData.id ? 'Projeyi Düzenle' : 'Yeni Proje'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proje Kodu *</label>
                  <input type="text" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  <select className="w-full border border-gray-300 p-2 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proje Adı *</label>
                <input type="text" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              {/* ÜST PROJE ARAMALI DROPDOWN */}
              <div className="relative" ref={parentDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Üst Proje (Sadece Devam Edenler)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Üst proje ara..." 
                    className="w-full border border-gray-300 p-2 pl-3 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={parentSearch}
                    onFocus={() => setIsParentDropdownOpen(true)}
                    onChange={(e) => {
                      setParentSearch(e.target.value);
                      setIsParentDropdownOpen(true);
                    }}
                  />
                  <div className="absolute right-2 top-2.5 flex items-center text-gray-400">
                     {formData.parent_id ? (
                        <button type="button" onClick={() => { setFormData({...formData, parent_id: null}); setParentSearch(''); }}>
                           <X size={18} className="hover:text-red-500" />
                        </button>
                     ) : (
                        <ChevronDown size={18} />
                     )}
                  </div>
                </div>
                {isParentDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {eligibleParents.length > 0 ? (
                      eligibleParents.map(p => (
                        <div 
                          key={p.id} 
                          className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 border-gray-100"
                          onClick={() => {
                            setFormData({...formData, parent_id: p.id});
                            setParentSearch(p.name);
                            setIsParentDropdownOpen(false);
                          }}
                        >
                          <div className="font-medium text-gray-800">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.code}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-gray-500 text-center">Uygun proje bulunamadı.</div>
                    )}
                  </div>
                )}
              </div>

              {/* MÜŞTERİ (CARİ) ARAMALI DROPDOWN */}
              <div className="relative" ref={customerDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri (Cari)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Müşteri ara..." 
                    className="w-full border border-gray-300 p-2 pl-3 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={customerSearch}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                  />
                  <div className="absolute right-2 top-2.5 flex items-center text-gray-400">
                     {formData.customer_id ? (
                        <button type="button" onClick={() => { setFormData({...formData, customer_id: null}); setCustomerSearch(''); }}>
                           <X size={18} className="hover:text-red-500" />
                        </button>
                     ) : (
                        <ChevronDown size={18} />
                     )}
                  </div>
                </div>
                {isCustomerDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {eligibleCustomers.length > 0 ? (
                      eligibleCustomers.map(c => (
                        <div 
                          key={c.id} 
                          className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 border-gray-100"
                          onClick={() => {
                            setFormData({...formData, customer_id: c.id});
                            setCustomerSearch(c.name);
                            setIsCustomerDropdownOpen(false);
                          }}
                        >
                          <div className="font-medium text-gray-800">{c.name}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-gray-500 text-center">Müşteri bulunamadı.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                  <input type="date" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                  <input type="date" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea rows="2" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                  <Save size={18}/> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;