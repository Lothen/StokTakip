import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase'; 
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button, Card, Table, Form, Select, InputNumber, Input, message, Divider, Space, Tooltip, Spin } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, RobotOutlined, FileTextOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const Production = () => {
    const [searchParams] = useSearchParams(); // URL parametrelerini oku
    const navigate = useNavigate();
    const editDocNo = searchParams.get('docNo'); // Düzenlenecek Fiş No

    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false); // Sayfa verisi yükleniyor mu?
    
    // Form Durumları
    const [targetProduct, setTargetProduct] = useState(null);
    const [targetQuantity, setTargetQuantity] = useState(1);
    const [ingredients, setIngredients] = useState([]);
    const [description, setDescription] = useState('');
    const [documentNo, setDocumentNo] = useState(''); 
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false); // Düzenleme modu mu?

    // Otomatik Fiş No Üretici
    const generateDocumentNo = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `URT-${year}${month}${day}-${random}`;
    };

    // 1. Verileri ve (Varsa) Düzenlenecek Kaydı Yükle
    useEffect(() => {
        const init = async () => {
            setPageLoading(true);
            await fetchInitialData();
            
            // Eğer URL'de docNo varsa, o fişin detaylarını çek ve forma doldur
            if (editDocNo) {
                setIsEditMode(true);
                await fetchTransactionDetails(editDocNo);
            } else {
                setDocumentNo(generateDocumentNo()); // Yeni kayıt ise otomatik no ver
            }
            setPageLoading(false);
        };
        init();
    }, [editDocNo]);

    const fetchInitialData = async () => {
        const { data: stockData } = await supabase.from('stocks').select('id, name, stock_code, unit_id');
        const { data: warehouseData } = await supabase.from('warehouses').select('id, name');
        
        if (stockData) setStocks(stockData);
        if (warehouseData) {
            setWarehouses(warehouseData);
            // Sadece yeni kayıtta varsayılan seç, edit modunda veritabanından geleni bekleyeceğiz
            if (!editDocNo && warehouseData.length > 0) setSelectedWarehouse(warehouseData[0].id);
        }
    };

    // DÜZENLEME İÇİN VERİ ÇEKME FONKSİYONU
    const fetchTransactionDetails = async (docNo) => {
        // Bu fiş numarasına ait tüm hareketleri çek
        const { data, error } = await supabase
            .from('stock_transactions')
            .select('*')
            .eq('document_no', docNo);

        if (error || !data || data.length === 0) {
            message.error('Kayıt bulunamadı!');
            return;
        }

        // --- VERİYİ AYRIŞTIRMA (GİRDİLER vs ÇIKTILAR) ---
        
        // 1. Üretilen Ürün (target): direction = 1 (Giriş) ve type = 'production'
        const productionItem = data.find(item => item.direction === 1 && item.transaction_type === 'production');
        
        // 2. Hammaddeler (ingredients): direction = -1 (Çıkış) ve type = 'usage'
        const usageItems = data.filter(item => item.direction === -1 && item.transaction_type === 'usage');

        if (productionItem) {
            setDocumentNo(productionItem.document_no);
            setDescription(productionItem.description);
            setSelectedWarehouse(productionItem.warehouse_id);
            setTargetProduct(productionItem.stock_id);
            setTargetQuantity(productionItem.quantity);
        }

        if (usageItems.length > 0) {
            const parsedIngredients = usageItems.map(item => ({
                stock_id: item.stock_id,
                quantity: item.quantity
            }));
            setIngredients(parsedIngredients);
        }
    };

    const addIngredientRow = () => {
        setIngredients([...ingredients, { stock_id: null, quantity: 1 }]);
    };

    const updateIngredient = (index, field, value) => {
        const list = [...ingredients];
        list[index][field] = value;
        setIngredients(list);
    };

    const removeIngredient = (index) => {
        const list = [...ingredients];
        list.splice(index, 1);
        setIngredients(list);
    };

    const handleProduction = async () => {
        if (!documentNo) { message.error("Lütfen Belge No giriniz."); return; }
        if (!targetProduct || !selectedWarehouse) { message.error("Lütfen ürün ve depo seçin."); return; }
        if (ingredients.length === 0 || ingredients.some(i => !i.stock_id)) { message.error("Malzemeleri eksiksiz girin."); return; }

        setLoading(true);
        try {
            // --- GÜNCELLEME MANTIĞI ---
            // Eğer Düzenleme Modundaysak: Önce eski kayıtları sil, sonra yenisini ekle.
            // Bu yöntem en temizidir çünkü kullanıcı malzeme sayısını değiştirmiş olabilir.
            if (isEditMode) {
                const { error: deleteError } = await supabase
                    .from('stock_transactions')
                    .delete()
                    .eq('document_no', documentNo); // Mevcut belge no ile sil
                
                if (deleteError) throw deleteError;
            }

            // Yeni Kayıt (veya Güncellenmiş Kayıt) Oluştur
            const { error } = await supabase.rpc('execute_production', {
                p_target_stock_id: targetProduct,
                p_production_quantity: targetQuantity,
                p_ingredients: ingredients,
                p_warehouse_id: selectedWarehouse,
                p_description: description || 'Yarı Mamul Üretimi',
                p_document_no: documentNo
            });

            if (error) throw error;

            message.success(isEditMode ? "Üretim güncellendi!" : "Üretim başarıyla kaydedildi!");
            
            // İşlem bitince listeye dön veya formu temizle
            if (isEditMode) {
                navigate('/hareketler'); // Listeye geri dön
            } else {
                setIngredients([]);
                setDescription('');
                setTargetQuantity(1);
                setTargetProduct(null);
                setDocumentNo(generateDocumentNo());
            }

        } catch (error) {
            console.error('Hata:', error);
            message.error("İşlem hatası: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return <div className="p-10 text-center"><Spin size="large" tip="Veriler Yükleniyor..." /></div>;
    }

    return (
        <div style={{ padding: '20px' }}>
            <div className="flex items-center gap-4 mb-4">
                {isEditMode && (
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hareketler')}>
                        Geri Dön
                    </Button>
                )}
                <h2 className="m-0 flex items-center gap-2">
                    <RobotOutlined /> 
                    {isEditMode ? 'Üretim Fişini Düzenle' : 'Üretim & Birleştirme'}
                </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                
                {/* SOL TARAF: ÜRETİM BİLGİLERİ */}
                <Card title="1. Üretim Emri Bilgileri" style={{ flex: 1, minWidth: '300px' }} bordered={false}>
                    <Form layout="vertical">
                        <Form.Item label="Üretim Fiş No / Belge Adı" required>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Input 
                                    prefix={<FileTextOutlined />} 
                                    value={documentNo} 
                                    // Edit modunda belge no değiştirilemesin (karışıklığı önlemek için)
                                    disabled={isEditMode}
                                    onChange={(e) => setDocumentNo(e.target.value)} 
                                    placeholder="Otomatik..."
                                />
                                {!isEditMode && (
                                    <Tooltip title="Yeni Numara">
                                        <Button icon={<ReloadOutlined />} onClick={() => setDocumentNo(generateDocumentNo())} />
                                    </Tooltip>
                                )}
                            </div>
                        </Form.Item>

                        <Form.Item label="Depo Seçimi" required>
                            <Select 
                                value={selectedWarehouse}
                                onChange={setSelectedWarehouse}
                                options={warehouses.map(w => ({ value: w.id, label: w.name }))} 
                            />
                        </Form.Item>
                        <Form.Item label="Üretilecek Ürün" required>
                            <Select
                                showSearch
                                placeholder="Stok Ara..."
                                optionFilterProp="children"
                                value={targetProduct}
                                onChange={setTargetProduct}
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={stocks.map(s => ({ value: s.id, label: `${s.stock_code} - ${s.name}` }))}
                            />
                        </Form.Item>
                        <Form.Item label="Üretim Miktarı">
                            <InputNumber 
                                min={1} 
                                value={targetQuantity} 
                                onChange={setTargetQuantity} 
                                style={{ width: '100%' }} 
                                addonAfter="Adet"
                            />
                        </Form.Item>
                        <Form.Item label="Açıklama">
                            <Input.TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                        </Form.Item>
                    </Form>
                </Card>

                {/* SAĞ TARAF: REÇETE / MALZEMELER */}
                <Card title="2. Kullanılacak Malzemeler (Reçete)" style={{ flex: 2, minWidth: '400px' }}>
                    <Table
                        dataSource={ingredients}
                        rowKey={(record, index) => index}
                        pagination={false}
                        size="small"
                        footer={() => (
                            <Button type="dashed" onClick={addIngredientRow} block icon={<PlusOutlined />}>
                                Malzeme Ekle
                            </Button>
                        )}
                        columns={[
                            {
                                title: 'Hammadde / Malzeme',
                                dataIndex: 'stock_id',
                                render: (text, record, index) => (
                                    <Select
                                        showSearch
                                        style={{ width: '100%' }}
                                        placeholder="Malzeme Seç"
                                        value={record.stock_id}
                                        onChange={(val) => updateIngredient(index, 'stock_id', val)}
                                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                        options={stocks.map(s => ({ value: s.id, label: `${s.stock_code} - ${s.name}` }))}
                                    />
                                )
                            },
                            {
                                title: 'Miktar',
                                dataIndex: 'quantity',
                                width: 120,
                                render: (text, record, index) => (
                                    <InputNumber 
                                        min={0.01} 
                                        value={record.quantity} 
                                        onChange={(val) => updateIngredient(index, 'quantity', val)} 
                                        style={{ width: '100%' }} 
                                    />
                                )
                            },
                            {
                                title: '',
                                width: 50,
                                render: (_, record, index) => (
                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeIngredient(index)} />
                                )
                            }
                        ]}
                    />
                </Card>
            </div>

            <Divider />

            <div style={{ textAlign: 'right' }}>
                <Space>
                    <div style={{ color: isEditMode ? '#d46b08' : '#888', marginRight: 10 }}>
                        {isEditMode 
                            ? "* Güncelleme yapıldığında eski kayıt silinip yenisi oluşturulur." 
                            : "* Stoklar otomatik düşecek, yeni ürün maliyeti hesaplanıp eklenecek."
                        }
                    </div>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<SaveOutlined />} 
                        onClick={handleProduction}
                        loading={loading}
                        className={isEditMode ? 'bg-orange-600 hover:bg-orange-500' : ''}
                    >
                        {isEditMode ? 'Üretimi Güncelle' : 'Üretimi Kaydet'}
                    </Button>
                </Space>
            </div>
        </div>
    );
};

export default Production;