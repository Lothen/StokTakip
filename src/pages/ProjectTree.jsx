import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Network, ChevronRight, ChevronDown, Folder, FileText, Circle } from 'lucide-react';

// --- AĞAÇ DÜĞÜMÜ BİLEŞENİ (Recursive / Kendini Tekrar Eden) ---
// Bu bileşen her bir proje satırını çizer. Eğer alt projesi varsa,
// kendi içinde tekrar kendisini çağırarak alt alta açılmasını sağlar.
const ProjectNode = ({ project, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = project.children && project.children.length > 0;

  // Seviyeye göre soldan boşluk bırakma (Girinti)
  const paddingLeft = level * 20 + 10; 

  return (
    <div className="select-none">
      {/* Proje Satırı */}
      <div 
        className={`flex items-center p-3 border-b hover:bg-blue-50 transition-colors cursor-pointer group ${level === 0 ? 'bg-gray-50 font-semibold' : 'bg-white'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Girinti ve İkonlar */}
        <div style={{ paddingLeft: `${paddingLeft}px` }} className="flex items-center gap-2 flex-1">
          
          {/* Aç/Kapa Oku (Sadece alt projesi varsa görünür) */}
          <div className="w-6 h-6 flex items-center justify-center text-gray-500">
            {hasChildren ? (
              isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />
            ) : (
              <Circle size={8} className="text-gray-300 fill-current" />
            )}
          </div>

          {/* Dosya/Klasör İkonu */}
          <div className="text-blue-600">
            {hasChildren ? <Folder size={20} /> : <FileText size={18} className="text-gray-400" />}
          </div>

          {/* Proje İsmi ve Kodu */}
          <div>
            <span className="text-gray-800 mr-2">{project.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
              {project.code}
            </span>
          </div>
        </div>

        {/* Sağ Taraf: Durum Etiketi */}
        <div className="flex gap-4 text-sm text-gray-600 pr-4">
          <span className={`px-2 py-0.5 rounded text-xs font-medium 
             ${project.status === 'Devam Ediyor' ? 'bg-blue-100 text-blue-700' : 
               project.status === 'Tamamlandı' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* Alt Projeler (Recursive Çağrı) */}
      {/* Eğer satır açıksa ve alt projeler varsa burası çizilir */}
      {isOpen && hasChildren && (
        <div className="border-l-2 border-gray-100 ml-4 animate-in slide-in-from-top-2 duration-200">
          {project.children.map(child => (
            <ProjectNode key={child.id} project={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


// --- ANA SAYFA BİLEŞENİ ---
const ProjectTree = () => {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAndBuildTree();
    }
  }, [user]);

  const fetchAndBuildTree = async () => {
    setLoading(true);
    
    // 1. Tenant ID'yi bul
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    // 2. Tüm Projeleri Çek (Sıralama önemli)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('code', { ascending: true });

    if (error) {
      console.error(error);
    } else {
      // 3. Düz listeyi Ağaç Yapısına (Hiyerarşi) çevir
      const hierarchy = buildHierarchy(projects);
      setTreeData(hierarchy);
    }
    setLoading(false);
  };

  // Yardımcı Fonksiyon: Düz array'i parent_id'ye göre iç içe array yapar
  const buildHierarchy = (items) => {
    const dataMap = {};
    const tree = [];

    // Önce tüm projeleri ID'lerine göre bir objeye koy ve hepsine boş bir 'children' dizisi ekle
    items.forEach(item => {
      dataMap[item.id] = { ...item, children: [] };
    });

    // Sonra her projeyi kontrol et:
    // - Eğer parent_id'si varsa, git babasını bul ve onun 'children' dizisine ekle.
    // - Eğer parent_id'si yoksa, bu bir Ana Projedir, direkt ağacın köküne (tree) ekle.
    items.forEach(item => {
      if (item.parent_id && dataMap[item.parent_id]) {
        dataMap[item.parent_id].children.push(dataMap[item.id]);
      } else {
        tree.push(dataMap[item.id]);
      }
    });

    return tree;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Network className="text-blue-600" /> Proje Hiyerarşisi
            </h1>
            <p className="text-gray-500 text-sm mt-1">Ana projeler ve alt projelerin ağaç görünümü</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Ağaç yapısı yükleniyor...</div>
        ) : treeData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Henüz hiç proje yok.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {treeData.map((node) => (
              <ProjectNode key={node.id} project={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTree;