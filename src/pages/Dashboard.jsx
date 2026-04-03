import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Yolunuzu projenize göre ayarlayın
import { useAuth } from '../context/AuthContext';
import { Card, Tag, Spin, Typography, Button, Row, Col, Statistic, Empty } from 'antd';
import { 
    RocketOutlined, 
    ProjectOutlined, 
    DollarCircleOutlined,
    ExportOutlined,
    ArrowRightOutlined,
    AppstoreOutlined,
    HistoryOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    ShopOutlined // Depo ikonu için eklendi
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Dashboard = () => {
    const { user } = useAuth(); 
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Veri State'leri
    const [projects, setProjects] = useState([]);
    const [stockValue, setStockValue] = useState(0);
    const [projectSpend, setProjectSpend] = useState(0);
    const [totalStockCount, setTotalStockCount] = useState(0); 
    const [totalWarehouseCount, setTotalWarehouseCount] = useState(0); // YENİ: Toplam Depo Sayısı
    const [recentTransactions, setRecentTransactions] = useState([]); 
    
    useEffect(() => {
        if (user) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. ÖNCE KULLANICININ FİRMASINI (TENANT_ID) BUL
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single();
                
            const tenantId = profile?.tenant_id;
            if (!tenantId) return; 

            // 2. AKTİF PROJELERİ ÇEK
            const { data: projectData } = await supabase
                .from('projects')
                .select('*')
                .eq('tenant_id', tenantId) 
                .ilike('status', '%Devam%')
                .order('created_at', { ascending: false })
                .limit(5);
            
            setProjects(projectData || []);

            // 3. TOPLAM STOK DEĞERİNİ ÇEK 
            const { data: valueData } = await supabase.rpc('get_total_stock_value');
            setStockValue(valueData || 0);

            // 4. PROJELERE HARCANAN TUTARI HESAPLA
            const { data: spendData } = await supabase
                .from('stock_transactions')
                .select('quantity, price, direction, transaction_type')
                .eq('tenant_id', tenantId) 
                .eq('direction', -1) 
                .in('transaction_type', ['usage', 'production_out', 'project_transfer']);

            let totalSpend = 0;
            if (spendData) {
                totalSpend = spendData.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
            }
            setProjectSpend(totalSpend);

            // 5. TOPLAM STOK KARTI SAYISI
            const { count: stockCount } = await supabase
                .from('stocks')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId); 
            setTotalStockCount(stockCount || 0);

            // 6. YENİ: TOPLAM DEPO SAYISI
            const { count: warehouseCount } = await supabase
                .from('warehouses')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId); 
            setTotalWarehouseCount(warehouseCount || 0);

            // 7. SON STOK HAREKETLERİ
            const { data: txData } = await supabase
                .from('stock_transactions')
                .select(`
                    id, document_no, quantity, direction, transaction_type, created_at,
                    stocks (name)
                `)
                .eq('tenant_id', tenantId) 
                .order('created_at', { ascending: false })
                .limit(6);
            setRecentTransactions(txData || []);

        } catch (error) {
            console.error("Veri çekme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    };

    const getTransactionLabel = (type) => {
        const types = {
            'purchase': 'Satınalma Girişi',
            'stock_in': 'Hızlı Giriş/Devir',
            'production_out': 'Projeye Çıkış',
            'usage': 'Üretim Tüketim',
            'production': 'Üretimden Giriş'
        };
        return types[type] || 'Transfer/Hareket';
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Spin size="large" />
            <span className="mt-4 text-gray-500 font-medium">Veriler Yükleniyor...</span>
        </div>
    );

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={2} style={{ margin: 0 }}>Yönetim Paneli</Title>
                    <Text type="secondary">İşletmenizin anlık finansal ve operasyonel özeti</Text>
                </div>
                <Button type="primary" onClick={fetchDashboardData}>Verileri Yenile</Button>
            </div>

            {/* --- KPI KARTLARI (5 KART - Kısayol butonlarıyla) --- */}
            <Row gutter={[16, 16]} className="mb-8">
                
                {/* 1. DEPODAKİ PARA */}
                <Col xs={24} sm={12} lg={8}>
                    <Card 
                        variant="borderless" 
                        className="shadow-sm border-l-4 border-l-green-500 hover:shadow-md transition-shadow h-full"
                        extra={<Button type="link" size="small" onClick={() => navigate('/stok-durumu')} className="text-gray-400 hover:text-green-600">Detay <ArrowRightOutlined /></Button>}
                    >
                        <Statistic
                            title="Toplam Depo Varlığı"
                            value={stockValue}
                            formatter={(val) => <span className="text-green-700 font-bold text-xl lg:text-2xl truncate block">{formatCurrency(val)}</span>}
                            prefix={<DollarCircleOutlined className="text-green-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 2. PROJELERE HARCANAN */}
                <Col xs={24} sm={12} lg={8}>
                    <Card 
                        variant="borderless" 
                        className="shadow-sm border-l-4 border-l-orange-500 hover:shadow-md transition-shadow h-full"
                        extra={<Button type="link" size="small" onClick={() => navigate('/hareketler/liste')} className="text-gray-400 hover:text-orange-600">Detay <ArrowRightOutlined /></Button>}
                    >
                        <Statistic
                            title="Projelere Harcanan"
                            value={projectSpend}
                            formatter={(val) => <span className="text-orange-700 font-bold text-xl lg:text-2xl truncate block">{formatCurrency(val)}</span>}
                            prefix={<ExportOutlined className="text-orange-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 3. DEVAM EDEN PROJELER */}
                <Col xs={24} sm={12} lg={8}>
                    <Card 
                        variant="borderless" 
                        className="shadow-sm border-l-4 border-l-blue-500 hover:shadow-md transition-shadow h-full"
                        extra={<Button type="link" size="small" onClick={() => navigate('/projeler')} className="text-gray-400 hover:text-blue-600">Detay <ArrowRightOutlined /></Button>}
                    >
                        <Statistic
                            title="Devam Eden Projeler"
                            value={projects.length}
                            formatter={(val) => <span className="text-blue-700 font-bold text-2xl">{val} <span className="text-sm font-normal text-gray-400">Adet</span></span>}
                            prefix={<RocketOutlined className="text-blue-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 4. TOPLAM ÜRÜN ÇEŞİDİ */}
                <Col xs={24} sm={12} lg={8}>
                    <Card 
                        variant="borderless" 
                        className="shadow-sm border-l-4 border-l-purple-500 hover:shadow-md transition-shadow h-full"
                        extra={<Button type="link" size="small" onClick={() => navigate('/stoklar')} className="text-gray-400 hover:text-purple-600">Detay <ArrowRightOutlined /></Button>}
                    >
                        <Statistic
                            title="Kayıtlı Stok Kartı"
                            value={totalStockCount}
                            formatter={(val) => <span className="text-purple-700 font-bold text-2xl">{val} <span className="text-sm font-normal text-gray-400">Çeşit</span></span>}
                            prefix={<AppstoreOutlined className="text-purple-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 5. YENİ: TOPLAM DEPO SAYISI */}
                <Col xs={24} sm={12} lg={8}>
                    <Card 
                        variant="borderless" 
                        className="shadow-sm border-l-4 border-l-teal-500 hover:shadow-md transition-shadow h-full"
                        extra={<Button type="link" size="small" onClick={() => navigate('/depolar')} className="text-gray-400 hover:text-teal-600">Detay <ArrowRightOutlined /></Button>}
                    >
                        <Statistic
                            title="Kayıtlı Depolar"
                            value={totalWarehouseCount}
                            formatter={(val) => <span className="text-teal-700 font-bold text-2xl">{val} <span className="text-sm font-normal text-gray-400">Adet</span></span>}
                            prefix={<ShopOutlined className="text-teal-500 mr-2" />}
                        />
                    </Card>
                </Col>

            </Row>

            {/* --- LİSTELER --- */}
            <Row gutter={[16, 16]}>
                
                {/* SOL: SON AKTİF PROJELER */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<div className="flex items-center gap-2 text-blue-700"><ProjectOutlined /> Son Aktif Projeler</div>} 
                        variant="borderless" 
                        className="shadow-md h-full"
                        extra={<Button type="link" onClick={() => navigate('/projeler')}>Tümünü Gör</Button>}
                    >
                        {projects.length === 0 ? (
                            <Empty description="Aktif proje bulunamadı." />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100">
                                {projects.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded-lg transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 text-blue-600 w-10 h-10 flex items-center justify-center rounded-lg text-lg shrink-0">
                                                <ProjectOutlined />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{item.code}</span>
                                                    <Tag color="processing" className="m-0 text-[10px]">{item.status}</Tag>
                                                </div>
                                                <div className="text-sm text-gray-500">{item.name}</div>
                                            </div>
                                        </div>
                                        <Button type="text" className="text-blue-600" icon={<ArrowRightOutlined />} onClick={() => navigate(`/projeler`)} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>

                {/* SAĞ: SON STOK HAREKETLERİ */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<div className="flex items-center gap-2 text-slate-700"><HistoryOutlined /> Son Stok Hareketleri</div>} 
                        variant="borderless" 
                        className="shadow-md h-full"
                        extra={<Button type="link" onClick={() => navigate('/hareketler/liste')}>Tümünü Gör</Button>}
                    >
                        {recentTransactions.length === 0 ? (
                            <Empty description="Henüz stok hareketi yok." />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100">
                                {recentTransactions.map((tx) => {
                                    const isIn = tx.direction === 1;
                                    return (
                                        <div key={tx.id} className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded-lg transition-colors group">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg shrink-0 ${isIn ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                    {isIn ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-gray-800 truncate pr-2">{tx.stocks?.name || 'Bilinmeyen Ürün'}</span>
                                                        <span className={`font-bold whitespace-nowrap ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                                                            {isIn ? '+' : '-'}{tx.quantity}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{tx.document_no}</span>
                                                        <span>•</span>
                                                        <span>{getTransactionLabel(tx.transaction_type)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </Col>

            </Row>
        </div>
    );
};

export default Dashboard;