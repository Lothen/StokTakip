import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Calendar, Eye, Trash2 } from 'lucide-react';

const PurchaseInvoiceList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

    // Faturaları, Tedarikçi isimleriyle beraber çekiyoruz
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select(`
        *,
        companies:company_id (name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('issue_date', { ascending: false });

    if (error) console.error(error);
    else setInvoices(data || []);
    
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu faturayı ve bağlı stok hareketlerini silmek istediğinize emin misiniz?")) return;

    const { error } = await supabase.from('purchase_invoices').delete().eq('id', id);
    if (error) {
      alert("Hata: " + error.message);
    } else {
      setInvoices(invoices.filter(inv => inv.id !== id));
      // Trigger sayesinde stok hareketleri de otomatik silinecek!
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.document_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.companies?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 w-full">
      
      {/* BAŞLIK VE BUTON */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={28} className="text-blue-600" /> Satınalma Faturaları
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sisteme girilmiş tüm mal kabul evrakları</p>
        </div>
        
        <Link to="/satinalma/yeni" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all">
          <Plus size={20} /> Yeni Fatura Gir
        </Link>
      </div>

      {/* ARAMA */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Fatura No veya Tedarikçi Ara..." 
            className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* LİSTE */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-20" />
            <p>Kayıtlı fatura bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Belge No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tedarikçi</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Tutar</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Durum</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400"/>
                        {inv.issue_date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                      {inv.document_no}
                      <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                        {inv.document_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {inv.companies?.name || 'Bilinmiyor'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                      {inv.total_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full 
                        ${inv.status === 'Onaylandı' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-gray-400 hover:text-red-600 transition-colors" title="Sil" onClick={() => handleDelete(inv.id)}>
                        <Trash2 size={18} />
                      </button>
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

export default PurchaseInvoiceList;