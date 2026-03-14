export interface EquipmentRule {
  id: string;
  triggerKeywords: string[];
  triggerCodes: string[];
  items: EquipmentItem[];
}

export interface EquipmentItem {
  equipment_fr: string;
  equipment_ar: string;
  unit: string;
  defaultQuantity: number;
  catalogCode?: string;
}

export const EQUIPMENT_RULES: EquipmentRule[] = [
  {
    id: 'peinture_facade',
    triggerKeywords: ['façade', 'facade', 'ravalement', 'peinture extérieure', 'peinture exterieure'],
    triggerCodes: ['PEI05', 'PEI06'],
    items: [
      { equipment_fr: 'Location échafaudage', equipment_ar: 'كراء سقالة', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC01' },
      { equipment_fr: 'Bâche de protection', equipment_ar: 'غطاء حماية', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Rouleaux peinture', equipment_ar: 'بكرات دهان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Nettoyeur haute pression', equipment_ar: 'آلة تنظيف بالضغط العالي', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'peinture_murs',
    triggerKeywords: ['peinture mur', 'peinture murale', 'peinture intérieure', 'peinture interieure'],
    triggerCodes: ['PEI01', 'PEI02', 'PEI03', 'PEI04'],
    items: [
      { equipment_fr: 'Bâche de protection', equipment_ar: 'غطاء حماية', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Rouleaux peinture', equipment_ar: 'بكرات دهان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Ruban de masquage', equipment_ar: 'شريط لاصق للحماية', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'enduit_murs',
    triggerKeywords: ['enduit', 'enduire', 'crépi', 'crepi'],
    triggerCodes: ['PEI07', 'PEI08'],
    items: [
      { equipment_fr: 'Malaxeur', equipment_ar: 'خلاط', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Taloche', equipment_ar: 'مالج', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Protection sol', equipment_ar: 'حماية الأرضية', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'poncage_murs',
    triggerKeywords: ['ponçage', 'poncage', 'poncer'],
    triggerCodes: ['PEI09'],
    items: [
      { equipment_fr: 'Ponceuse murale', equipment_ar: 'آلة صنفرة الجدران', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Aspirateur chantier', equipment_ar: 'مكنسة ورشة', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'carrelage_sol',
    triggerKeywords: ['carrelage sol', 'pose carrelage', 'carrelage'],
    triggerCodes: ['CAR01', 'CAR02'],
    items: [
      { equipment_fr: 'Colle carrelage', equipment_ar: 'غراء بلاط', unit: 'forfait', defaultQuantity: 1, catalogCode: 'FRC01' },
      { equipment_fr: 'Croisillons', equipment_ar: 'صلبان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Coupe carrelage', equipment_ar: 'قاطعة بلاط', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Niveau laser', equipment_ar: 'ميزان ليزر', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'faience_murale',
    triggerKeywords: ['faïence', 'faience', 'faïence murale'],
    triggerCodes: ['CAR03'],
    items: [
      { equipment_fr: 'Colle carrelage', equipment_ar: 'غراء بلاط', unit: 'forfait', defaultQuantity: 1, catalogCode: 'FRC01' },
      { equipment_fr: 'Croisillons', equipment_ar: 'صلبان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Coupe carrelage', equipment_ar: 'قاطعة بلاط', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'parquet_flottant',
    triggerKeywords: ['parquet flottant', 'stratifié', 'stratifie', 'sol stratifié'],
    triggerCodes: ['PAR01', 'PAR02'],
    items: [
      { equipment_fr: 'Sous-couche parquet', equipment_ar: 'طبقة تحتية للباركيه', unit: 'forfait', defaultQuantity: 1, catalogCode: 'FRC04' },
      { equipment_fr: 'Scie', equipment_ar: 'منشار', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Maillet', equipment_ar: 'مطرقة خشبية', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'parquet_massif',
    triggerKeywords: ['parquet massif', 'parquet collé', 'parquet colle'],
    triggerCodes: ['PAR03'],
    items: [
      { equipment_fr: 'Colle parquet', equipment_ar: 'غراء باركيه', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Scie radiale', equipment_ar: 'منشار دائري', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'chape_beton',
    triggerKeywords: ['chape', 'chape béton', 'chape beton'],
    triggerCodes: ['MAC01', 'MAC02'],
    items: [
      { equipment_fr: 'Location bétonnière', equipment_ar: 'كراء خلاطة إسمنت', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC03' },
      { equipment_fr: 'Règle maçon', equipment_ar: 'مسطرة بناء', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Niveau laser', equipment_ar: 'ميزان ليزر', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'dalle_beton',
    triggerKeywords: ['dalle', 'dalle béton', 'dalle beton', 'fondation'],
    triggerCodes: ['MAC03', 'MAC04'],
    items: [
      { equipment_fr: 'Location bétonnière', equipment_ar: 'كراء خلاطة إسمنت', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC03' },
      { equipment_fr: 'Règle aluminium', equipment_ar: 'مسطرة ألومنيوم', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Taloche', equipment_ar: 'مالج', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'demolition_mur',
    triggerKeywords: ['démolition mur', 'demolition mur', 'casser mur', 'abattre mur', 'démolition'],
    triggerCodes: ['MAC09'],
    items: [
      { equipment_fr: 'Location marteau piqueur', equipment_ar: 'كراء مطرقة هوائية', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Location benne à gravats', equipment_ar: 'كراء حاوية أنقاض', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC04' },
      { equipment_fr: 'Protection chantier', equipment_ar: 'حماية الورشة', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'demolition_carrelage',
    triggerKeywords: ['démolition carrelage', 'demolition carrelage', 'dépose carrelage', 'depose carrelage'],
    triggerCodes: ['FRC02'],
    items: [
      { equipment_fr: 'Location marteau piqueur', equipment_ar: 'كراء مطرقة هوائية', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Location benne à gravats', equipment_ar: 'كراء حاوية أنقاض', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC04' },
    ],
  },
  {
    id: 'creation_terrasse',
    triggerKeywords: ['terrasse', 'création terrasse', 'creation terrasse'],
    triggerCodes: ['MAC05'],
    items: [
      { equipment_fr: 'Location bétonnière', equipment_ar: 'كراء خلاطة إسمنت', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC03' },
      { equipment_fr: 'Règle maçon', equipment_ar: 'مسطرة بناء', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Taloche', equipment_ar: 'مالج', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'pose_fenetre',
    triggerKeywords: ['fenêtre', 'fenetre', 'pose fenêtre', 'pose fenetre', 'baie vitrée'],
    triggerCodes: ['MEN01', 'MEN02'],
    items: [
      { equipment_fr: 'Mousse PU', equipment_ar: 'رغوة بولي يوريثان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Niveau laser', equipment_ar: 'ميزان ليزر', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Silicone', equipment_ar: 'سيليكون', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'pose_porte',
    triggerKeywords: ['porte', 'pose porte', 'porte intérieure', 'porte interieure'],
    triggerCodes: ['MEN03', 'MEN04'],
    items: [
      { equipment_fr: 'Mousse PU', equipment_ar: 'رغوة بولي يوريثان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Niveau laser', equipment_ar: 'ميزان ليزر', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'installation_wc',
    triggerKeywords: ['wc', 'toilette', 'installation wc', 'pose wc'],
    triggerCodes: ['PLM05'],
    items: [
      { equipment_fr: 'Silicone', equipment_ar: 'سيليكون', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Clé plomberie', equipment_ar: 'مفتاح سباكة', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'installation_douche',
    triggerKeywords: ['douche', 'installation douche', 'pose douche', 'receveur'],
    triggerCodes: ['PLM06'],
    items: [
      { equipment_fr: 'Silicone', equipment_ar: 'سيليكون', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Perceuse', equipment_ar: 'مثقاب', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Niveau', equipment_ar: 'ميزان', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'plomberie_generale',
    triggerKeywords: ['plomberie', 'tuyauterie', 'canalisation', 'raccord'],
    triggerCodes: ['PLM01', 'PLM02', 'PLM03', 'PLM04'],
    items: [
      { equipment_fr: 'Clé plomberie', equipment_ar: 'مفتاح سباكة', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Coupe tube', equipment_ar: 'قاطعة أنابيب', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'electricite',
    triggerKeywords: ['électricité', 'electricite', 'câblage', 'cablage', 'tableau électrique', 'prise électrique'],
    triggerCodes: ['ELE01', 'ELE02', 'ELE03'],
    items: [
      { equipment_fr: 'Testeur de tension', equipment_ar: 'جهاز قياس الجهد', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Perceuse', equipment_ar: 'مثقاب', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Gaine électrique', equipment_ar: 'أنبوب كهربائي', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'spot_led',
    triggerKeywords: ['spot', 'spot led', 'spot encastré', 'spot encastre', 'luminaire encastré'],
    triggerCodes: ['ELE04'],
    items: [
      { equipment_fr: 'Scie cloche', equipment_ar: 'منشار دائري للثقوب', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Tournevis', equipment_ar: 'مفك', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'decapage_piscine',
    triggerKeywords: ['décapage', 'decapage', 'décapage piscine', 'sablage'],
    triggerCodes: ['PIS01', 'PIS02'],
    items: [
      { equipment_fr: 'Location sableuse', equipment_ar: 'كراء آلة السفع الرملي', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC02' },
      { equipment_fr: 'Sable', equipment_ar: 'رمل', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Compresseur', equipment_ar: 'ضاغط هواء', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Protection chantier', equipment_ar: 'حماية الورشة', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'resine_piscine',
    triggerKeywords: ['résine piscine', 'resine piscine', 'résine', 'resine'],
    triggerCodes: ['PIS03'],
    items: [
      { equipment_fr: 'Rouleaux résine', equipment_ar: 'بكرات راتنج', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Mélangeur', equipment_ar: 'خلاط', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'carrelage_piscine',
    triggerKeywords: ['carrelage piscine', 'mosaïque piscine', 'mosaique piscine'],
    triggerCodes: ['PIS04'],
    items: [
      { equipment_fr: 'Colle piscine', equipment_ar: 'غراء مسبح', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Croisillons', equipment_ar: 'صلبان', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Coupe carrelage', equipment_ar: 'قاطعة بلاط', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
  {
    id: 'nettoyage_toiture',
    triggerKeywords: ['nettoyage toiture', 'nettoyage toit', 'démoussage', 'demoussage'],
    triggerCodes: ['TOI01'],
    items: [
      { equipment_fr: 'Nettoyeur haute pression', equipment_ar: 'آلة تنظيف بالضغط العالي', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Location échafaudage', equipment_ar: 'كراء سقالة', unit: 'forfait', defaultQuantity: 1, catalogCode: 'LOC01' },
    ],
  },
  {
    id: 'traitement_toiture',
    triggerKeywords: ['traitement toiture', 'hydrofuge', 'imperméabilisant', 'impermeabilisant'],
    triggerCodes: ['TOI02'],
    items: [
      { equipment_fr: 'Pulvérisateur', equipment_ar: 'رشاش', unit: 'forfait', defaultQuantity: 1 },
      { equipment_fr: 'Protection sol', equipment_ar: 'حماية الأرضية', unit: 'forfait', defaultQuantity: 1 },
    ],
  },
];
