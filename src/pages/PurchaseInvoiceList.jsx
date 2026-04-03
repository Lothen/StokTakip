import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Calendar, Trash2, Pencil, FileDown, X } from 'lucide-react'; 
import * as XLSX from 'xlsx'; 

const PurchaseInvoiceList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtre State'leri
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

    // GÜNCELLEME: Fatura kalemlerini de çekiyoruz ki Net ve KDV hesaplayabilelim
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select(`
        *,
        companies:company_id (name),
        purchase_invoice_items (
          quantity, unit_price, discount_rate, tax_rate
        )
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
    }
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = inv.document_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (inv.companies?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStart = startDate ? inv.issue_date >= startDate : true;
    const matchEnd = endDate ? inv.issue_date <= endDate : true;

    return matchSearch && matchStart && matchEnd;
  });

  // YENİ: Her fatura için Net ve KDV hesaplayan yardımcı fonksiyon
  const calculateInvoiceTotals = (items = []) => {
    return items.reduce((acc, item) => {
      const gross = (item.quantity || 0) * (item.unit_price || 0);
      const discountAmount = gross * ((item.discount_rate || 0) / 100);
      const lineNet = gross - discountAmount;
      const taxAmount = lineNet * ((item.tax_rate || 0) / 100);
      
      return {
        subtotal: acc.subtotal + lineNet,
        tax: acc.tax + taxAmount,
        grandTotal: acc.grandTotal + lineNet + taxAmount
      };
    }, { subtotal: 0, tax: 0, grandTotal: 0 });
  };

  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      alert("Dışa aktarılacak fatura bulunamadı.");
      return;
    }

    const headerInfo = [
      ['SATINALMA FATURALARI LİSTESİ'],
      [''],
      ['--- FİLTRE KRİTERLERİ ---'],
      ['Arama Metni:', searchTerm || 'Tümü'],
      ['Başlangıç Tarihi:', startDate || 'Belirtilmedi'],
      ['Bitiş Tarihi:', endDate || 'Belirtilmedi'],
      ['']
    ];

    // GÜNCELLEME: Sütun başlıklarına Net ve KDV eklendi
    const tableHeaders = ['Tarih', 'Belge No', 'Belge Tipi', 'Tedarikçi', 'Net Toplam', 'KDV Tutarı', 'Genel Toplam', 'Durum'];

    const exportData = filteredInvoices.map(inv => {
      const totals = calculateInvoiceTotals(inv.purchase_invoice_items);
      return [
        inv.issue_date,
        inv.document_no,
        inv.document_type,
        inv.companies?.name || 'Bilinmiyor',
        totals.subtotal,
        totals.tax,
        inv.total_amount || totals.grandTotal, // Güvenlik için veritabanındaki kayıtlı tutar öncelikli
        inv.status
      ];
    });

    const finalData = [...headerInfo, tableHeaders, ...exportData];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalData);

    // Sütun genişlikleri güncellendi
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, "Faturalar");
    XLSX.writeFile(wb, `Satinalma_Faturalari.xlsx`);
  };

  return (
    <div className="p-6 w-full">
      
      {/* BAŞLIK VE BUTONLAR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={28} className="text-blue-600" /> Satınalma Faturaları
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sisteme girilmiş tüm mal kabul evrakları</p>
        </div>
        
        <div className="flex items-center gap-3">
          {filteredInvoices.length > 0 && (
            <button 
              onClick={handleExportExcel}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm"
              title="Filtrelenmiş listeyi Excel olarak indir"
            >
              <FileDown size={20} /> Excel'e Aktar
            </button>
          )}

          <Link to="/satinalma/yeni" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm">
            <Plus size={20} /> Yeni Fatura Gir
          </Link>
        </div>
      </div>

      {/* ARAMA VE TARİH FİLTRESİ */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arama</label>
            <Search className="absolute left-3 top-[34px] text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Fatura No veya Tedarikçi Ara..." 
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Başlangıç Tarihi</label>
            <input 
              type="date" 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <div className="w-full">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bitiş Tarihi</label>
              <input 
                type="date" 
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={clearDates} 
                className="mb-0.5 p-2.5 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                title="Tarihleri Temizle"
              >
                <X size={20}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LİSTE */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-20" />
            <p>Kayıtlı fatura bulunamadı veya filtrelere uyan sonuç yok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Belge No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tedarikçi</th>
                  {/* GÜNCELLEME: Net ve KDV başlıkları eklendi */}
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Net Toplam</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">KDV</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-600 uppercase">Genel Toplam</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Durum</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((inv) => {
                  // Her fatura satırı çizilirken tutarları hesaplatıyoruz
                  const totals = calculateInvoiceTotals(inv.purchase_invoice_items);
                  
                  return (
                    <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400"/>
                          {inv.issue_date}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                        <button 
                          onClick={() => navigate(`/satinalma/duzenle/${inv.document_no}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {inv.document_no}
                        </button>
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                          {inv.document_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {inv.companies?.name || 'Bilinmiyor'}
                      </td>
                      {/* GÜNCELLEME: Net ve KDV hücreleri eklendi */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                        {totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {totals.tax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-600 bg-blue-50/30">
                        {(inv.total_amount || totals.grandTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full 
                          ${inv.status === 'Onaylandı' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-3 items-center">
                          <button 
                            className="text-blue-500 hover:text-blue-700 transition-colors p-1" 
                            title="Görüntüle / Düzenle" 
                            onClick={() => navigate(`/satinalma/duzenle/${inv.document_no}`)}
                          >
                            <Pencil size={18} />
                          </button>
                          
                          <button 
                            className="text-gray-400 hover:text-red-600 transition-colors p-1" 
                            title="Sil" 
                            onClick={() => handleDelete(inv.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default PurchaseInvoiceList;