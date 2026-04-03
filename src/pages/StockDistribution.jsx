import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Map, Search, Building2, Briefcase, FileDown, Box, ChevronDown, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- ARAMALI SEÇİM BİLEŞENİ ---
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
    (opt.code && opt.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full p-3 border rounded-lg cursor-pointer flex items-center justify-between bg-white transition-all min-h-[50px]
        ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-gray-700 w-full">
           {selectedItem ? (
             <>
               {Icon && <Icon size={18} className="text-blue-600 shrink-0"/>}
               <div className="flex flex-col truncate leading-tight">
                 <span className="font-bold text-sm truncate">{selectedItem.name}</span>
                 {selectedItem.code && <span className="text-[10px] text-gray-400 font-mono">{selectedItem.code}</span>}
               </div>
             </>
           ) : (
             <>
               {Icon && <Icon size={18} className="text-gray-400 shrink-0"/>}
               <span className="text-gray-400 text-sm">{placeholder}</span>
             </>
           )}
        </div>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-[999] overflow-hidden">
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
                   <div className="truncate">
                     <span className="font-bold">{opt.code ? `${opt.code} - ` : ''}</span>
                     {opt.name}
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- ANA BİLEŞEN ---
const StockDistribution = () => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedStockId, setSelectedStockId] = useState('');
  const [stockList, setStockList] = useState([]);
  
  const [warehouseMap, setWarehouseMap] = useState({});
  const [projectMap, setProjectMap] = useState({});
  const [distributionData, setDistributionData] = useState([]);

  useEffect(() => {
    if (user) fetchDependencies();
  }, [user]);

  useEffect(() => {
    if (selectedStockId) {
      fetchStockDistribution();
    } else {
      setDistributionData([]);
    }
  }, [selectedStockId]);

  const fetchDependencies = async () => {
    setDataLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    const tenantId = profile.tenant_id;

    // 1. Stokları Çek
    const { data: stocks } = await supabase.from('stocks').select(`id, name, stock_code, units(name)`).eq('tenant_id', tenantId);
    setStockList(stocks?.map(s => ({ id: s.id, name: s.name, code: s.stock_code, unit: s.units?.name || '-' })) || []);

    // 2. Depoları Çek ve Map'le
    const { data: wh } = await supabase.from('warehouses').select('id, name').eq('tenant_id', tenantId);
    const wMap = {};
    wh?.forEach(w => wMap[w.id] = w.name);
    setWarehouseMap(wMap);

    // 3. Projeleri Çek ve Map'le
    const { data: prj } = await supabase.from('projects').select('id, name, code').eq('tenant_id', tenantId);
    const pMap = {};
    prj?.forEach(p => pMap[p.id] = `${p.code} - ${p.name}`);
    setProjectMap(pMap);

    setDataLoading(false);
  };

  const fetchStockDistribution = async () => {
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();

    // Mevcut durum view'inden sadece seçili stoğu çekiyoruz
    const { data, error } = await supabase
      .from('stock_current_status_view')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('stock_id', selectedStockId);

    if (error) {
      console.error(error);
    } else {
      // Sadece miktarı 0 olmayanları filtrele
      const activeData = (data || []).filter(item => parseFloat(item.quantity) !== 0);
      setDistributionData(activeData);
    }
    setLoading(false);
  };

  // --- EXCEL'E AKTARMA ---
  const handleExportExcel = () => {
    if (distributionData.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      return;
    }

    const selectedStock = stockList.find(s => s.id === selectedStockId);
    const stockNameText = selectedStock ? `${selectedStock.code} - ${selectedStock.name}` : 'Bilinmeyen Ürün';

    const headerInfo = [
      ['STOK KONUM DAĞILIM RAPORU'],
      [''],
      ['İncelenen Ürün:', stockNameText],
      [''],
      ['Tesis Dağılımı']
    ];

    const tableHeaders = ['Konum Tipi', 'Konum Adı', 'Mevcut Miktar', 'Birim'];

    const exportData = distributionData.map(item => {
      const locName = item.location_type === 'Depo' 
          ? warehouseMap[item.location_id] || 'Bilinmeyen Depo'
          : projectMap[item.location_id] || 'Bilinmeyen Proje';

      return [
        item.location_type,
        locName,
        item.quantity,
        item.unit || '-'
      ];
    });

    const finalData = [...headerInfo, tableHeaders, ...exportData];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalData);

    ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, "Stok_Dagilimi");
    
    const safeFileName = selectedStock?.code ? selectedStock.code.replace(/[^a-z0-9]/gi, '_') : 'Urun';
    XLSX.writeFile(wb, `Stok_Dagilimi_${safeFileName}.xlsx`);
  };

  // Verileri tiplerine göre ayır
  const warehouseData = distributionData.filter(d => d.location_type === 'Depo');
  const projectData = distributionData.filter(d => d.location_type === 'Proje');

  const totalWarehouseQty = warehouseData.reduce((acc, curr) => acc + parseFloat(curr.quantity), 0);
  const totalProjectQty = projectData.reduce((acc, curr) => acc + parseFloat(curr.quantity), 0);
  const grandTotal = totalWarehouseQty + totalProjectQty;

  const activeStock = stockList.find(s => s.id === selectedStockId);

  if (dataLoading) {
    return <div className="p-10 text-center text-gray-500">Sayfa yükleniyor...</div>;
  }

  return (
    <div className="p-6 w-full">
      {/* BAŞLIK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Map size={28} className="text-teal-600" /> Stok Dağılım Raporu
          </h1>
          <p className="text-sm text-gray-500 mt-1">Seçilen ürünün tüm depo ve projelerdeki miktar dağılımı.</p>
        </div>
        {selectedStockId && distributionData.length > 0 && (
          <button 
            onClick={handleExportExcel}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition shadow-sm font-medium shrink-0"
            title="Tabloyu Excel olarak indir"
          >
            <FileDown size={20} /> Excel'e Aktar
          </button>
        )}
      </div>

      {/* SEÇİM PANELİ */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">İncelenecek Ürünü Seçin</label>
        <div className="max-w-2xl">
          <SearchableSelect 
            options={stockList} 
            value={selectedStockId} 
            onChange={setSelectedStockId} 
            placeholder="Stok Kodu veya Adı ile Ara..." 
            icon={Package}
          />
        </div>
      </div>

      {/* DURUM ALANI */}
      {!selectedStockId ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <Search size={48} className="mb-4 opacity-20" />
          <p>Dağılımı görmek için yukarıdan bir ürün seçiniz.</p>
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-gray-500">Hesaplanıyor...</div>
      ) : distributionData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <Box size={48} className="mb-4 opacity-20" />
          <p>Bu ürüne ait aktif bir stok bulunamadı.</p>
        </div>
      ) : (
        <>
          {/* ÖZET KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl shadow-md text-white relative overflow-hidden">
              <div className="text-green-100 font-bold text-sm uppercase mb-1">Genel Toplam (Tüm Tesisler)</div>
              <div className="text-3xl font-black">
                {grandTotal} <span className="text-lg font-medium opacity-80">{activeStock?.unit}</span>
              </div>
              <Box size={80} className="absolute -right-4 -bottom-4 text-white opacity-20" />
            </div>
            
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase mb-1">Depolardaki Toplam</div>
                <div className="text-2xl font-bold text-blue-600">{totalWarehouseQty} <span className="text-sm text-gray-400">{activeStock?.unit}</span></div>
              </div>
              <div className="bg-blue-50 p-3 rounded-full text-blue-500"><Building2 size={24} /></div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase mb-1">Projelerdeki Toplam</div>
                <div className="text-2xl font-bold text-orange-600">{totalProjectQty} <span className="text-sm text-gray-400">{activeStock?.unit}</span></div>
              </div>
              <div className="bg-orange-50 p-3 rounded-full text-orange-500"><Briefcase size={24} /></div>
            </div>
          </div>

          {/* DETAY TABLOLARI (Yan Yana) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SOL: DEPOLAR */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                <h3 className="font-bold text-blue-800">Depo Dağılımı</h3>
              </div>
              {warehouseData.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">Depolarda bu üründen bulunmuyor.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Depo Adı</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Miktar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {warehouseData.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                          {warehouseMap[d.location_id] || 'Bilinmiyor'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {d.quantity} <span className="text-[10px] text-gray-400">{d.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* SAĞ: PROJELER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-orange-50 border-b border-orange-100 p-4 flex items-center gap-2">
                <Briefcase size={20} className="text-orange-600" />
                <h3 className="font-bold text-orange-800">Proje Dağılımı</h3>
              </div>
              {projectData.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">Projelerde bu üründen bulunmuyor.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Proje Adı</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Miktar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectData.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                          {projectMap[d.location_id] || 'Bilinmiyor'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {d.quantity} <span className="text-[10px] text-gray-400">{d.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
};

export default StockDistribution;