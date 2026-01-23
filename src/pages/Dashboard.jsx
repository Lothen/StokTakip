import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Card, Tag, Spin, Typography, Button, Row, Col, Statistic, Empty, List } from 'antd';
import { 
    RocketOutlined, 
    ProjectOutlined, 
    CalendarOutlined,
    DollarCircleOutlined,
    ExportOutlined,
    AlertOutlined,
    ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Veri State'leri
    const [projects, setProjects] = useState([]);
    const [stockValue, setStockValue] = useState(0);
    const [projectSpend, setProjectSpend] = useState(0);
    
    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. AKTİF PROJELERİ ÇEK (Bu zaten çalışıyordu)
            const { data: projectData } = await supabase
                .from('projects')
                .select('*')
                .ilike('status', '%Devam%')
                .order('created_at', { ascending: false });
            
            setProjects(projectData || []);

            // 2. TOPLAM STOK DEĞERİNİ ÇEK (Bu da çalışıyordu - RPC ile)
            const { data: valueData } = await supabase.rpc('get_total_stock_value');
            setStockValue(valueData || 0);

            // 3. PROJELERE HARCANAN TUTARI HESAPLA (YENİ - GÜVENLİ YÖNTEM)
            // SQL fonksiyonu yerine, son 1000 çıkış hareketini çekip burada topluyoruz. Hata vermez.
            const { data: spendData } = await supabase
                .from('stock_transactions')
                .select('quantity, price, direction, transaction_type')
                .eq('direction', -1) // Sadece çıkışlar
                .in('transaction_type', ['usage', 'production_out', 'project_transfer']); // Proje/Üretim harcamaları

            let totalSpend = 0;
            if (spendData) {
                totalSpend = spendData.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
            }
            setProjectSpend(totalSpend);

        } catch (error) {
            console.error("Veri çekme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
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

            {/* --- KPI KARTLARI --- */}
            <Row gutter={[16, 16]} className="mb-8">
                
                {/* 1. DEPODAKİ PARA (YEŞİL) */}
                <Col xs={24} sm={12} lg={8}>
                    <Card variant="borderless" className="shadow-sm border-l-4 border-l-green-500 hover:shadow-md transition-shadow h-full">
                        <Statistic
                            title="Toplam Depo Varlığı"
                            value={stockValue}
                            formatter={(val) => <span className="text-green-700 font-bold text-2xl">{formatCurrency(val)}</span>}
                            prefix={<DollarCircleOutlined className="text-green-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 2. DEVAM EDEN PROJELER (MAVİ) */}
                <Col xs={24} sm={12} lg={8}>
                    <Card variant="borderless" className="shadow-sm border-l-4 border-l-blue-500 hover:shadow-md transition-shadow h-full">
                        <Statistic
                            title="Devam Eden Projeler"
                            value={projects.length}
                            formatter={(val) => <span className="text-blue-700 font-bold text-2xl">{val} <span className="text-sm font-normal text-gray-400">Adet</span></span>}
                            prefix={<RocketOutlined className="text-blue-500 mr-2" />}
                        />
                    </Card>
                </Col>

                {/* 3. PROJELERE HARCANAN (TURUNCU) */}
                <Col xs={24} sm={12} lg={8}>
                    <Card variant="borderless" className="shadow-sm border-l-4 border-l-orange-500 hover:shadow-md transition-shadow h-full">
                        <Statistic
                            title="Projelere Harcanan"
                            value={projectSpend}
                            formatter={(val) => <span className="text-orange-700 font-bold text-2xl">{formatCurrency(val)}</span>}
                            prefix={<ExportOutlined className="text-orange-500 mr-2" />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* --- DETAY LİSTESİ --- */}
            <Row gutter={[16, 16]}>
                <Col xs={24}>
                    <Card 
                        title={<div className="flex items-center gap-2 text-blue-700"><ProjectOutlined /> Son Aktif Projeler</div>} 
                        variant="borderless" 
                        className="shadow-md"
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
                                        <Button 
                                            type="text" 
                                            className="text-blue-600" 
                                            icon={<ArrowRightOutlined />}
                                            onClick={() => navigate(`/projeler`)}
                                        >
                                            Detay
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;