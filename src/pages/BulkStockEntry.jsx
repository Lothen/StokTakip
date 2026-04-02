import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Download, UploadCloud, Save, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const BulkStockEntry = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [importStatus, setImportStatus] = useState(null); // 'success', 'error', null

  useEffect(() => {
    if (user) fetchDependencies();
  }, [user]);

  const fetchDependencies = async () => {
    // Excel'deki "ADET", "KG" gibi yazıları ID'ye çevirmek için birimleri çekiyoruz
    const { data } = await supabase.from('units').select('id, name, code');
    if (data) setUnits(data);
  };

  // --- 1. ŞABLON İNDİRME ---
  const handleDownloadTemplate = () => {
    // 1. Sayfa: Doldurulacak Şablon
    const templateData = [
      ['Stok Kodu*', 'Üretici Kodu', 'Stok Adı*', 'İkinci İsim', 'Açıklama', 'Birim Kodu*', 'Alış Fiyatı', 'Alış Dövizi', 'Satış Fiyatı', 'Satış Dövizi', 'KDV Oranı (%)'],
      ['STK-001', 'MNF-123', 'Örnek Rulman', '', '10mm çelik rulman', 'ADET', 150, 'TRY', 200, 'TRY', 20],
      ['STK-002', '', 'Örnek Kablo', '', '', 'MT', 15.5, 'USD', 25, 'USD', 20]
    ];

    // 2. Sayfa: Kullanılabilecek Birim Kodları (Kullanıcıya kopya çekmesi için)
    const unitsReference = [['Geçerli Birim Kodları', 'Birim Adı']];
    units.forEach(u => unitsReference.push([u.code, u.name]));

    const wb = XLSX.utils.book_new();
    
    const wsTemplate = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Stok_Sablonu");

    const wsUnits = XLSX.utils.aoa_to_sheet(unitsReference);
    XLSX.utils.book_append_sheet(wb, wsUnits, "Birim_Kodlari_Rehberi");

    XLSX.writeFile(wb, "toplu_stok_sablonu.xlsx");
  };

  // --- 2. DOSYA YÜKLEME VE OKUMA ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0]; // İlk sayfayı al
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setPreviewData(data);
    };

    reader.readAsBinaryString(file);
  };

  // --- 3. VERİTABANINA KAYDETME ---
  const handleSaveToDatabase = async () => {
    if (previewData.length === 0) return alert("Önce dolu bir Excel dosyası yükleyin.");
    setLoading(true);
    setImportStatus(null);

    try {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      const tenantId = profile.tenant_id;

      // Veriyi veritabanı formatına dönüştür
      const stocksToInsert = previewData.map((row, index) => {
        // Excel'deki başlıklarla eşleştiriyoruz
        const stockCode = row['Stok Kodu*'];
        const name = row['Stok Adı*'];
        const unitCode = row['Birim Kodu*'];

        if (!stockCode || !name || !unitCode) {
            throw new Error(`Satır ${index + 2}: Stok Kodu, Stok Adı ve Birim Kodu zorunludur!`);
        }

        // Birim Kodunu ('ADET') veritabanı ID'sine çevir
        const matchedUnit = units.find(u => u.code?.toUpperCase() === String(unitCode).toUpperCase());
        if (!matchedUnit) {
            throw new Error(`Satır ${index + 2}: "${unitCode}" adında geçersiz bir birim kodu kullanılmış.`);
        }

        return {
          tenant_id: tenantId,
          stock_code: String(stockCode),
          manufacturer_code: row['Üretici Kodu'] ? String(row['Üretici Kodu']) : null,
          name: String(name),
          second_name: row['İkinci İsim'] ? String(row['İkinci İsim']) : null,
          description: row['Açıklama'] ? String(row['Açıklama']) : null,
          unit_id: matchedUnit.id,
          buying_price: parseFloat(row['Alış Fiyatı']) || 0,
          buying_currency_code: row['Alış Dövizi'] || 'TRY',
          selling_price: parseFloat(row['Satış Fiyatı']) || 0,
          selling_currency_code: row['Satış Dövizi'] || 'TRY',
          vat_rate: parseFloat(row['KDV Oranı (%)']) || 20
        };
      });

      // Toplu Ekleme Yap
      const { error } = await supabase.from('stocks').insert(stocksToInsert);

      if (error) {
        if (error.code === '23505') throw new Error("Yüklediğiniz listedeki bazı Stok Kodları sistemde zaten var. Lütfen çakışmaları düzeltin.");
        throw error;
      }

      setImportStatus('success');
      setPreviewData([]); // Başarılı olunca tabloyu temizle
      
    } catch (error) {
      console.error("İçe aktarma hatası:", error);
      alert(error.message);
      setImportStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/stoklar')} className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft size={24} className="text-gray-600"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">Toplu Stok Girişi</h1>
          <p className="text-sm text-gray-500">Excel şablonunu indirip doldurarak yüzlerce stoğu tek seferde yükleyin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* ADIM 1: ŞABLON İNDİR */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Download size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">1. Şablonu İndir</h2>
            <p className="text-sm text-gray-500 mb-6">Sistemin anlayabileceği formattaki boş Excel dosyasını bilgisayarınıza indirin.</p>
            <button onClick={handleDownloadTemplate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors w-full">
                Şablonu İndir (.xlsx)
            </button>
        </div>

        {/* ADIM 2: DOSYA YÜKLE */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
                <UploadCloud size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">2. Dosyayı Yükle</h2>
            <p className="text-sm text-gray-500 mb-6">Doldurduğunuz şablon dosyasını seçerek sisteme aktarım işlemini başlatın.</p>
            <div className="relative w-full">
                <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors w-full flex items-center justify-center gap-2">
                    <UploadCloud size={20} /> Excel Dosyası Seç
                </button>
            </div>
        </div>
      </div>

      {importStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="shrink-0" />
              <div>
                  <strong>Başarılı!</strong> Stoklar veritabanına sorunsuz bir şekilde aktarıldı. <br/>
                  <button onClick={() => navigate('/stoklar')} className="underline text-sm font-bold mt-1">Stok Listesine Dön</button>
              </div>
          </div>
      )}

      {/* ÖNİZLEME TABLOSU */}
      {previewData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2 text-gray-700">
                    <AlertCircle size={20} className="text-orange-500" />
                    <strong>{previewData.length} adet stok</strong> aktarılmaya hazır. Lütfen kontrol edip onaylayın.
                </div>
                <button 
                    onClick={handleSaveToDatabase}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    <Save size={18}/> {loading ? 'Aktarılıyor...' : 'Veritabanına Kaydet'}
                </button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-gray-500">Stok Kodu</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-500">Stok Adı</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-500">Birim</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-500">Alış</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-500">Satış</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {previewData.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono font-bold text-gray-700">{row['Stok Kodu*'] || '-'}</td>
                                <td className="px-4 py-3">
                                    <div className="font-bold text-gray-800">{row['Stok Adı*'] || '-'}</div>
                                    <div className="text-[10px] text-gray-400">{row['Üretici Kodu'] || ''}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{row['Birim Kodu*'] || '-'}</td>
                                <td className="px-4 py-3 text-right">{row['Alış Fiyatı'] || 0} {row['Alış Dövizi']}</td>
                                <td className="px-4 py-3 text-right">{row['Satış Fiyatı'] || 0} {row['Satış Dövizi']}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default BulkStockEntry;