/**
 * Multilingual Benchmark Dataset & Evaluation Rubrics (Cognify 2.0 - Requirement 15)
 *
 * Trilingual dataset and evaluation rubrics for French, Arabic (Egyptian + MSA), and English.
 * Contains linguistic fixtures for:
 * 1. French Travel Assistant: Metro directions, emergency numbers, cultural etiquette,
 *    airport navigation, restaurant ordering.
 * 2. Spatial queries in French: 'Où sont mes clés ?', 'As-tu vu mes lunettes ?', 'Où ai-je posé ma canne ?'.
 * 3. French academic explanations with Bloom's taxonomy: 'Expliquez-moi le concept de récursion',
 *    'Analysez la complexité temporelle'.
 * 4. Arabic queries & dialect switching: 'فين مفاتيحي؟', 'اشرحلي المؤشرات بلغة بسيطة'.
 * 5. Trilingual parity validation and evaluation rubrics.
 */

import type { CognitiveStage } from '../types/studentState';
import { STAGE_READABILITY_LIMITS, calculateCognitiveComplexity } from './aiQualityGuard2';
import { detectConversationalStrain } from './conversationalStrain';
import { cleanForSpeech } from './tts';
import { CONCEPT_REGISTRY } from './conceptGraph';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

export type LanguageCode = 'fr' | 'ar' | 'en';
export type ArabicDialect = 'egyptian' | 'msa';

export type FrenchTravelCategory =
  | 'polite'
  | 'cafe'
  | 'restaurant'
  | 'metro'
  | 'airport'
  | 'hotel'
  | 'emergency'
  | 'shopping';

export interface FrenchTravelPhraseFixture {
  id: string;
  category: FrenchTravelCategory;
  fr: string;
  ar: string;
  arPhonetic: string;
  en: string;
  enPhonetic: string;
  culturalNote?: string;
  context: string;
  keywords: string[];
}

export interface EmergencyServiceFixture {
  number: '15' | '17' | '18' | '112' | '114';
  serviceNameFr: string;
  serviceNameEn: string;
  serviceNameAr: string;
  descriptionFr: string;
  descriptionEn: string;
  descriptionAr: string;
  sampleQueriesFr: string[];
  sampleQueriesAr: string[];
  sampleQueriesEn: string[];
  primaryDomain: 'medical' | 'police' | 'fire_rescue' | 'eu_general' | 'deaf_sms';
}

export interface SpatialQueryFixture {
  id: string;
  lang: LanguageCode;
  query: string;
  targetObject: string;
  category: 'keys' | 'glasses' | 'cane' | 'remote' | 'medication' | 'other';
  expectedSurfaceFr: string;
  expectedRoomFr: string;
  expectedPhrasingCues: string[];
  staleQueryCues: string[];
}

export type BloomLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface BloomLevelInfo {
  level: BloomLevel;
  nameEn: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  nameFr: 'Mémoriser' | 'Comprendre' | 'Appliquer' | 'Analyser' | 'Évaluer' | 'Créer';
  nameAr: 'تذكر' | 'فهم' | 'تطبيق' | 'تحليل' | 'تقييم' | 'ابتكار';
  verbsFr: string[];
  verbsEn: string[];
}

export interface AcademicExplanationFixture {
  id: string;
  conceptId: 'recursion' | 'asymptotic_complexity' | 'pointers' | 'dynamic_memory';
  promptFr: string;
  bloomLevel: BloomLevel;
  cognitiveStage: CognitiveStage;
  expectedResponseFr: string;
  keyFrenchTerms: string[];
  forbiddenEnglishTokens: string[];
  forbiddenRoboticTokens: string[];
  expectedAnalogies?: string[];
  expectedFormulas?: string[];
  maxWordsPerSentence: number;
}

export interface ArabicQueryFixture {
  id: string;
  dialect: ArabicDialect;
  query: string;
  intent: 'spatial' | 'academic_explanation' | 'strain';
  expectedDialectResponse: string;
  expectedTone: 'baladi' | 'formal_msa';
  pedagogicalDirective: string;
}

export interface TrilingualConceptNode {
  id: string;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionFr: string;
  domain: 'computer_science' | 'mathematics' | 'science' | 'general';
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
}

export interface EvaluationRubricCriteria {
  weight: number;
  description: string;
  passingThreshold: number;
}

// ============================================================================
// 2. BLOOM'S TAXONOMY REGISTRY
// ============================================================================

export const BLOOM_TAXONOMY: Record<BloomLevel, BloomLevelInfo> = {
  1: {
    level: 1,
    nameEn: 'Remember',
    nameFr: 'Mémoriser',
    nameAr: 'تذكر',
    verbsFr: ['définir', 'lister', 'rappeler', 'énoncer', 'identifier'],
    verbsEn: ['define', 'list', 'recall', 'state', 'identify'],
  },
  2: {
    level: 2,
    nameEn: 'Understand',
    nameFr: 'Comprendre',
    nameAr: 'فهم',
    verbsFr: ['expliquer', 'résumer', 'illustrer', 'paraphraser', 'décrire'],
    verbsEn: ['explain', 'summarize', 'illustrate', 'paraphrase', 'describe'],
  },
  3: {
    level: 3,
    nameEn: 'Apply',
    nameFr: 'Appliquer',
    nameAr: 'تطبيق',
    verbsFr: ['implémenter', 'exécuter', 'calculer', 'démontrer', 'utiliser'],
    verbsEn: ['implement', 'execute', 'calculate', 'demonstrate', 'use'],
  },
  4: {
    level: 4,
    nameEn: 'Analyze',
    nameFr: 'Analyser',
    nameAr: 'تحليل',
    verbsFr: ['décomposer', 'différencier', 'comparer', 'examiner', 'disséquer'],
    verbsEn: ['deconstruct', 'differentiate', 'compare', 'examine', 'dissect'],
  },
  5: {
    level: 5,
    nameEn: 'Evaluate',
    nameFr: 'Évaluer',
    nameAr: 'تقييم',
    verbsFr: ['juger', 'critiquer', 'justifier', 'peser les compromis', 'estimer'],
    verbsEn: ['judge', 'critique', 'justify', 'evaluate trade-offs', 'assess'],
  },
  6: {
    level: 6,
    nameEn: 'Create',
    nameFr: 'Créer',
    nameAr: 'ابتكار',
    verbsFr: ['concevoir', 'formuler', 'construire', 'inventer', 'synthétiser'],
    verbsEn: ['design', 'formulate', 'construct', 'invent', 'synthesize'],
  },
};

// ============================================================================
// 3. FRENCH TRAVEL ASSISTANT LINGUISTIC FIXTURES
// ============================================================================

export const FRENCH_TRAVEL_FIXTURES: FrenchTravelPhraseFixture[] = [
  // Cultural Etiquette & Greetings
  {
    id: 'fr_etiquette_01',
    category: 'polite',
    fr: 'Bonjour Madame / Bonjour Monsieur',
    ar: 'صباح الخير سيدتي / صباح الخير سيدي (القاعدة الذهبية في فرنسا: ابدأ بها دائمًا)',
    arPhonetic: 'بونجور مادام / بونجور مسيو',
    en: "Good morning / Hello Ma'am / Sir (Always say this first before asking anything)",
    enPhonetic: 'bohn-zhoor mah-dahm / bohn-zhoor muh-syur',
    culturalNote: 'Règle d’or : Ne posez jamais une question sans dire Bonjour au préalable.',
    context: 'Every public encounter in France, stores, metro, streets',
    keywords: ['bonjour', 'madame', 'monsieur', 'salutation', 'politesse'],
  },
  {
    id: 'fr_etiquette_02',
    category: 'polite',
    fr: "S'il vous plaît",
    ar: 'من فضلك / لو سمحت',
    arPhonetic: 'سيل فو بليه',
    en: 'Please',
    enPhonetic: 'seel voo pleh',
    culturalNote: 'Indispensable pour toute demande ou commande.',
    context: 'Ordering, asking questions, service requests',
    keywords: ['s il vous plait', 'svp', 'please', 'politesse'],
  },
  {
    id: 'fr_etiquette_03',
    category: 'polite',
    fr: 'Merci beaucoup, bonne journée !',
    ar: 'شكرًا جزيلاً، أتمنى لك يومًا سعيدًا!',
    arPhonetic: 'ميرسي بوكو، بون جورنيه !',
    en: 'Thank you very much, have a nice day!',
    enPhonetic: 'mehr-see boh-koo, buhn zhoor-nay',
    culturalNote: 'Formule idéale pour clore poliment une interaction.',
    context: 'Departing shops, concluding interactions',
    keywords: ['merci', 'bonne journee', 'au revoir'],
  },
  {
    id: 'fr_etiquette_04',
    category: 'shopping',
    fr: 'Je regarde seulement, merci beaucoup !',
    ar: 'أنا فقط أتفرج، شكرًا جزيلاً!',
    arPhonetic: 'جو روغارد سولمان، ميرسي بوكو !',
    en: "I'm just browsing, thank you!",
    enPhonetic: 'zhuh ruh-gard suhl-mahn, mehr-see boh-koo',
    culturalNote: 'Réponse polie attendue lorsque le commerçant vous salue à l’entrée.',
    context: 'Boutiques, department stores, retail shops',
    keywords: ['regarde seulement', 'boutique', 'magasin', 'shopping'],
  },

  // Metro & Urban Transit
  {
    id: 'fr_metro_01',
    category: 'metro',
    fr: 'Où se trouve la station de métro la plus proche ?',
    ar: 'أين تقع أقرب محطة مترو؟',
    arPhonetic: 'أو سو تروف لا ستاسيون دو ميترو لا بلو بروش؟',
    en: 'Where is the nearest metro station?',
    enPhonetic: 'oo suh troov lah stah-syohn duh may-troh lah ploo prohsh',
    culturalNote: 'À Paris, cherchez les mâts ou totems "Métro" ou "M".',
    context: 'Street navigation, finding transit',
    keywords: ['station', 'metro', 'proche', 'transport'],
  },
  {
    id: 'fr_metro_02',
    category: 'metro',
    fr: 'Je voudrais un ticket de métro, s\'il vous plaît.',
    ar: 'أريد تذكرة مترو، من فضلك.',
    arPhonetic: 'جو فودريه آن تيكيه دو ميترو، سيل فو بليه',
    en: 'I would like a metro ticket, please.',
    enPhonetic: 'zhuh voo-dray uhn tee-kay duh may-troh, seel voo pleh',
    culturalNote: 'Aujourd’hui dématérialisé sur passe Navigo Easy ou smartphone.',
    context: 'Ticket booth, guichet RATP',
    keywords: ['ticket', 'metro', 'navigo', 'billet'],
  },
  {
    id: 'fr_metro_03',
    category: 'metro',
    fr: "Quel quai pour le train vers l'aéroport Charles de Gaulle ?",
    ar: 'أي رصيف للقطار المتجه إلى مطار شارل ديجول؟',
    arPhonetic: 'كيل كيه بور لو تران فير لايروبور شارل ديجول؟',
    en: 'Which platform for the train to Charles de Gaulle Airport?',
    enPhonetic: 'kel kay poor luh tran vair lair-oh-por sharl duh gohl',
    culturalNote: 'Prendre le RER B direction Aéroport CDG 2 TGV.',
    context: 'Gare du Nord, Châtelet-Les Halles, Saint-Michel',
    keywords: ['quai', 'train', 'rer b', 'aeroport', 'charles de gaulle', 'cdg'],
  },
  {
    id: 'fr_metro_04',
    category: 'metro',
    fr: 'Est-ce que ce bus va vers la Tour Eiffel / le Musée du Louvre ?',
    ar: 'هل هذا الأتوبيس يتجه إلى برج إيفل / متحف اللوفر؟',
    arPhonetic: 'إيسك سو بيس فا فير لا تور إيفيل / لو موزيه دو لوفر؟',
    en: 'Does this bus go towards the Eiffel Tower / Louvre Museum?',
    enPhonetic: 'ess-kuh suh boos vah vair lah toor eye-fell / luh mew-zay dew loovr',
    culturalNote: 'Montez par l’avant du bus et validez votre titre.',
    context: 'Bus stop in Paris',
    keywords: ['bus', 'tour eiffel', 'louvre', 'direction'],
  },
  {
    id: 'fr_metro_05',
    category: 'metro',
    fr: 'Je suis perdu, pouvez-vous me montrer le chemin sur mon téléphone ?',
    ar: 'أنا تائه، هل يمكنك إرشادي إلى الطريق على هاتفي؟',
    arPhonetic: 'جو سوي بيردو، بوفيه فو مو مونتريه لو شومان سور مون تيليفون؟',
    en: 'I am lost, could you show me the way on my phone?',
    enPhonetic: 'zhuh swee pair-dew, poo-vay voo muh mohn-tray luh shuh-man soor mohn tay-lay-fon',
    culturalNote: 'Montrez l’écran avec l’application de cartographie ouverte.',
    context: 'Lost traveler asking local pedestrians',
    keywords: ['perdu', 'chemin', 'carte', 'telephone'],
  },

  // Airport Navigation (CDG & Orly)
  {
    id: 'fr_airport_01',
    category: 'airport',
    fr: 'Où se trouve la porte d\'embarquement pour le vol Air France ?',
    ar: 'أين تقع بوابة الصعود للطائرة لرحلة إير فرانس؟',
    arPhonetic: 'أو سو تروف لا بورت دومباركومان بور لو فول إير فرانس؟',
    en: 'Where is the boarding gate for the Air France flight?',
    enPhonetic: 'oo suh troov lah port dahm-bar-kuh-mahn poor luh vohl air france',
    culturalNote: 'À CDG Terminal 2, suivez les portes K, L ou M via le CDGVAL.',
    context: 'Airport terminal transit',
    keywords: ['porte d embarquement', 'vol', 'aeroport', 'terminal'],
  },
  {
    id: 'fr_airport_02',
    category: 'airport',
    fr: 'Comment rejoindre le Terminal 2E depuis la gare TGV / RER ?',
    ar: 'كيف أصل إلى الصالة 2E من محطة القطار / الـ RER؟',
    arPhonetic: 'كومون روجواندر لو تيرمينال دو أو دو بوي لا غار تي جي في؟',
    en: 'How do I get to Terminal 2E from the TGV / RER station?',
    enPhonetic: 'koh-mahn ruh-zhwahn-druh luh tair-mee-nahl duh uh duh-pwee lah gar tay-zhay-vay',
    culturalNote: 'Suivez la signalétique piétonne jaune vers le Terminal 2E.',
    context: 'CDG hub connections',
    keywords: ['terminal 2e', 'gare tgv', 'rer b', 'aeroport'],
  },
  {
    id: 'fr_airport_03',
    category: 'airport',
    fr: 'Où est la zone de récupération des bagages ?',
    ar: 'أين منطقة استلام الأمتعة والحقائب؟',
    arPhonetic: 'أو إيه لا زون دو ريكوبيراسيون دي باجاج؟',
    en: 'Where is the baggage claim area?',
    enPhonetic: 'oo ay lah zohn duh ray-kew-pay-rah-syohn day bah-gahzh',
    culturalNote: 'Recherchez les écrans indiquant le numéro de tapis bagages.',
    context: 'Arrival hall after passport control',
    keywords: ['bagages', 'recuperation', 'tapis', 'valises'],
  },

  // Restaurant & Café Ordering
  {
    id: 'fr_cafe_01',
    category: 'cafe',
    fr: 'Bonjour ! Un café et un croissant s\'il vous plaît.',
    ar: 'صباح الخير! قهوة وكرواسون من فضلك.',
    arPhonetic: 'بونجور! آن كافيه إيه آن كرواسون سيل فو بليه',
    en: 'Hello! A coffee and a croissant please.',
    enPhonetic: 'bohn-zhoor! uhn kah-fay ay uhn krwah-sahn seel voo pleh',
    culturalNote: 'En France, "un café" désigne par défaut un expresso.',
    context: 'Morning café counter or table',
    keywords: ['cafe', 'croissant', 'petit dejeuner', 'boulangerie'],
  },
  {
    id: 'fr_restaurant_01',
    category: 'restaurant',
    fr: "Une carafe d'eau s'il vous plaît.",
    ar: 'إبريق ماء صنبور من فضلك (مجاني بقوة القانون في فرنسا).',
    arPhonetic: 'أون كاراف دو سيل فو بليه',
    en: 'A jug of tap water please (Free of charge by law in France).',
    enPhonetic: 'ewn kah-rahf doh seel voo pleh',
    culturalNote: "En France, l'eau du robinet servie en carafe est d'excellente qualité et 100% gratuite par décret.",
    context: 'Dining at a restaurant table',
    keywords: ['carafe d eau', 'eau gratuite', 'restaurant', 'boisson'],
  },
  {
    id: 'fr_restaurant_02',
    category: 'restaurant',
    fr: "L'addition, s'il vous plaît.",
    ar: 'الحساب (الفاتورة) من فضلك.',
    arPhonetic: 'لاديسيون، سيل فو بليه',
    en: 'The bill, please.',
    enPhonetic: 'lah-dee-syohn, seel voo pleh',
    culturalNote: 'En France, les serveurs n’apportent jamais l’addition spontanément pour ne pas vous presser.',
    context: 'End of meal at restaurant or café',
    keywords: ['addition', 'payer', 'note', 'facture'],
  },
  {
    id: 'fr_restaurant_03',
    category: 'restaurant',
    fr: "Est-ce qu'il y a du porc ou de l'alcool dans ce plat ?",
    ar: 'هل يحتوي هذا الطبق على لحم خنزير أو كحول؟',
    arPhonetic: 'إيسك إيليا دي بورك أو دو لالقول دون سو بلا؟',
    en: 'Does this dish contain pork or alcohol?',
    enPhonetic: 'ess-keel-ee-ah dew pohr oo duh lal-kohl dahn suh plah',
    culturalNote: 'Crucial pour les régimes alimentaires halal, casher ou spécifiques.',
    context: 'Ordering food with dietary restrictions',
    keywords: ['porc', 'alcool', 'halal', 'regime alimentaire', 'ingredients'],
  },
  {
    id: 'fr_restaurant_04',
    category: 'restaurant',
    fr: 'Acceptez-vous la carte bancaire / le paiement sans contact ?',
    ar: 'هل تقبلون الدفع بالبطاقة البنكية / التلامسي؟',
    arPhonetic: 'أكسبتيه فو لا كارت بونكير / لو بايمان سون كونتاكت؟',
    en: 'Do you accept bank cards / contactless payment?',
    enPhonetic: 'ak-sep-tay voo lah kart bahn-kair / luh pay-mahn sahn kohn-takt',
    culturalNote: 'Le paiement sans contact est largement accepté partout en France dès 1€.',
    context: 'Paying at stores and restaurants',
    keywords: ['carte bancaire', 'sans contact', 'paiement', 'cb'],
  },
];

// ============================================================================
// 4. EMERGENCY SERVICES & HOTKEY FIXTURES
// ============================================================================

export const EMERGENCY_SERVICES_FIXTURES: EmergencyServiceFixture[] = [
  {
    number: '15',
    serviceNameFr: 'SAMU (Service d’Aide Médicale Urgente)',
    serviceNameEn: 'SAMU (Medical Emergencies Ambulance)',
    serviceNameAr: 'الإسعاف الطبي الطارئ (SAMU)',
    descriptionFr: 'Urgences vitales, malaise grave, détresse respiratoire, accident corporel.',
    descriptionEn: 'Life-threatening medical emergencies, severe illness, paramedics and emergency doctors.',
    descriptionAr: 'حالات الطوارئ الطبية الحرجة، الإغماء، الجلطات، والأزمات القلبية.',
    sampleQueriesFr: [
      'C’est une urgence médicale, quelqu’un a fait un malaise !',
      'Appelez le 15, mon ami ne respire plus !',
      'J’ai besoin d’une ambulance de toute urgence à Paris.',
      'Urgence hôpital / médecin régulateur.',
    ],
    sampleQueriesAr: [
      'طوارئ طبية، في شخص فاقد الوعي محتاج إسعاف فوراً!',
      'اتصل بـ 15، إسعاف فرنسا الطبي.',
    ],
    sampleQueriesEn: [
      'Medical emergency, someone collapsed and needs an ambulance!',
      'Call SAMU 15 now!',
    ],
    primaryDomain: 'medical',
  },
  {
    number: '17',
    serviceNameFr: 'Police Secours',
    serviceNameEn: 'Police Emergency Assistance',
    serviceNameAr: 'شرطة النجدة والطوارئ الجنائية',
    descriptionFr: 'Agression, vol à l’arraché, cambriolage, trouble grave à l’ordre public.',
    descriptionEn: 'Immediate police intervention for crimes, assaults, robberies, or imminent danger.',
    descriptionAr: 'شرطة النجدة للتدخل في حالات السرقة، الاعتداء، والجرائم المباشرة.',
    sampleQueriesFr: [
      'Au secours, on vient de me voler mon sac dans le métro !',
      'Appelez la police tout de suite, il y a une agression.',
      'Composez le 17 pour signaler un cambriolage.',
    ],
    sampleQueriesAr: [
      'الحقوني، شنطتي اتسرقت في المترو كلموا الشرطة 17!',
      'شرطة النجدة الفرنسية.',
    ],
    sampleQueriesEn: [
      'Help, someone stole my bag, call the police right now!',
      'Emergency police line 17.',
    ],
    primaryDomain: 'police',
  },
  {
    number: '18',
    serviceNameFr: 'Sapeurs-Pompiers',
    serviceNameEn: 'Firefighters & Rescue',
    serviceNameAr: 'المطافئ والإنقاذ والحوادث',
    descriptionFr: 'Incendie, fuite de gaz, accident de la circulation, secours aux victimes sur la voie publique.',
    descriptionEn: 'Fires, gas leaks, road collisions, physical street rescue operations.',
    descriptionAr: 'رجال الإطفاء والإنقاذ في حوادث السير، الحرائق، وتسرب الغاز.',
    sampleQueriesFr: [
      'Il y a un incendie dans l’immeuble, appelez les pompiers !',
      'Accident de la route avec des blessés, vite le 18 !',
      'Ça sent le gaz dans la cage d’escalier.',
    ],
    sampleQueriesAr: [
      'في حريق في العمارة، اتصلوا بالمطافئ 18 فوراً!',
      'حادثة عربيات في الشارع محتاجة إنقاذ.',
    ],
    sampleQueriesEn: [
      'There is a fire in the building, call the firefighters 18!',
      'Car crash on the street, need emergency rescue.',
    ],
    primaryDomain: 'fire_rescue',
  },
  {
    number: '112',
    serviceNameFr: 'Numéro d’Urgence Européen',
    serviceNameEn: 'European Emergency Number',
    serviceNameAr: 'رقم الطوارئ الأوروبي الموحد (متحدثو الإنجليزية)',
    descriptionFr: 'Numéro d’appel d’urgence unique européen valable partout dans l’UE avec opérateurs anglophones.',
    descriptionEn: 'Universal European emergency number with English-speaking dispatchers.',
    descriptionAr: 'رقم الطوارئ الموحد في كل دول أوروبا للمسافرين ومتحدثي الإنجليزية.',
    sampleQueriesFr: [
      'Je cherche le numéro d’urgence européen universel.',
      'Quel numéro d’urgence composer si je ne parle qu’anglais en Europe ?',
    ],
    sampleQueriesAr: [
      'رقم الطوارئ الموحد في أوروبا للإنجليزي 112.',
      'طوارئ عامة باللغة الإنجليزية في فرنسا.',
    ],
    sampleQueriesEn: [
      'What is the universal European emergency phone number?',
      'Dial 112 for English-speaking emergency operators in France.',
    ],
    primaryDomain: 'eu_general',
  },
  {
    number: '114',
    serviceNameFr: 'Numéro d’Urgence SMS pour Sourds et Malentendants',
    serviceNameEn: 'Emergency SMS line for Deaf and Hard of Hearing',
    serviceNameAr: 'طوارئ الرسائل النصية للصم وضعاف السمع (114)',
    descriptionFr: 'Service d’urgence accessible par SMS ou visiophonie pour personnes sourdes ou en situation de silence obligatoire.',
    descriptionEn: 'Emergency SMS and video chat hotline for deaf, hard of hearing, or silent emergency situations.',
    descriptionAr: 'خدمة الرسائل القصيرة SMS للطوارئ للصم وضعاف السمع أو في حالات الاختباء الصامت.',
    sampleQueriesFr: [
      'Je suis sourd, quel numéro par SMS pour les urgences en France ?',
      'Envoyer un SMS d’urgence au 114 sans parler au téléphone.',
    ],
    sampleQueriesAr: [
      'رقم طوارئ رسائل SMS للصم في فرنسا 114.',
    ],
    sampleQueriesEn: [
      'I am deaf and cannot speak on the phone, how to text emergency in France?',
      'Send emergency SMS to 114.',
    ],
    primaryDomain: 'deaf_sms',
  },
];

// ============================================================================
// 5. SPATIAL MEMORY FRENCH & ARABIC FIXTURES
// ============================================================================

export const SPATIAL_QUERIES_FIXTURES: SpatialQueryFixture[] = [
  {
    id: 'spatial_fr_keys',
    lang: 'fr',
    query: 'Où sont mes clés ?',
    targetObject: 'clés',
    category: 'keys',
    expectedSurfaceFr: 'Table basse',
    expectedRoomFr: 'Salon',
    expectedPhrasingCues: [
      'dernière fois',
      'clés',
      'table',
      'salon',
    ],
    staleQueryCues: [
      'remarque',
      'déplacé',
      'temps',
    ],
  },
  {
    id: 'spatial_fr_glasses',
    lang: 'fr',
    query: 'As-tu vu mes lunettes ?',
    targetObject: 'lunettes',
    category: 'glasses',
    expectedSurfaceFr: 'Table de chevet',
    expectedRoomFr: 'Chambre',
    expectedPhrasingCues: [
      'dernière fois',
      'lunettes',
      'table de chevet',
      'chambre',
    ],
    staleQueryCues: [
      'remarque',
      'déplacé',
      'temps',
    ],
  },
  {
    id: 'spatial_fr_cane',
    lang: 'fr',
    query: 'Où ai-je posé ma canne ?',
    targetObject: 'canne',
    category: 'other',
    expectedSurfaceFr: 'Porte-manteau',
    expectedRoomFr: 'Couloir',
    expectedPhrasingCues: [
      'dernière fois',
      'canne',
      'couloir',
    ],
    staleQueryCues: [
      'remarque',
      'déplacé',
      'temps',
    ],
  },
  {
    id: 'spatial_ar_keys',
    lang: 'ar',
    query: 'فين مفاتيحي؟',
    targetObject: 'المفاتيح',
    category: 'keys',
    expectedSurfaceFr: 'ترابيزة الصالة',
    expectedRoomFr: 'الصالة',
    expectedPhrasingCues: [
      'آخر مرة',
      'مفاتيح',
      'ترابيزة',
    ],
    staleQueryCues: [
      'ملاحظة',
      'تحريكه',
    ],
  },
];

// ============================================================================
// 6. FRENCH ACADEMIC EXPLANATIONS & BLOOM'S TAXONOMY FIXTURES
// ============================================================================

export const ACADEMIC_EXPLANATION_FIXTURES: AcademicExplanationFixture[] = [
  // 1. Recursion: Foundational (Bloom Level 2 - Understand / Metaphor)
  {
    id: 'acad_recursion_foundational',
    conceptId: 'recursion',
    promptFr: 'Expliquez-moi le concept de récursion',
    bloomLevel: 2,
    cognitiveStage: 'foundational',
    expectedResponseFr: `Imaginez des poupées russes.
Elles s'emboîtent les unes dans les autres.
En programmation, la récursion fonctionne ainsi.
C'est une fonction qui s'appelle elle-même.
Elle résout un problème plus petit.
Elle a toujours besoin d'une condition d'arrêt simple.
C'est le cas de base.
Dès que ce cas de base est atteint, tout s'arrête proprement.
Les étapes précédentes se terminent une par une.`,
    keyFrenchTerms: [
      'poupées russes',
      'récursion',
      'cas de base',
      'condition d\'arrêt',
      's\'appelle elle-même',
    ],
    forbiddenEnglishTokens: [
      'base case',
      'call stack',
      'step 1',
      'however',
      'in summary',
      'scene description',
      'none detected',
    ],
    forbiddenRoboticTokens: [
      '[Signs:',
      ':::',
      '**Hazards:**',
      '**Visible Text:**',
      '**Description de la scène:**',
    ],
    expectedAnalogies: ['poupées russes', 'miroir', 'boîtes'],
    maxWordsPerSentence: STAGE_READABILITY_LIMITS.foundational.maxAvgWordsPerSentence,
  },

  // 2. Recursion: Developing (Bloom Level 3 - Apply / Scaffolding)
  {
    id: 'acad_recursion_developing',
    conceptId: 'recursion',
    promptFr: 'Expliquez-moi le concept de récursion',
    bloomLevel: 3,
    cognitiveStage: 'developing',
    expectedResponseFr: `La récursion résout un problème complexe en le divisant en sous-problèmes identiques.
Ces sous-problèmes sont de taille réduite.
Une fonction récursive comprend toujours deux éléments fondamentaux.
Premièrement, le cas de base stoppe les appels récursifs lorsque la taille minimale est atteinte.
Deuxièmement, le pas récursif transforme les données et rappelle la fonction.
Par exemple, pour calculer la factorielle de 3, la machine multiplie 3 par factorielle de 2.
Cela continue jusqu'au cas de base où factorielle de 1 vaut 1.`,
    keyFrenchTerms: [
      'cas de base',
      'pas récursif',
      'sous-problèmes',
      'factorielle',
      'appels récursifs',
    ],
    forbiddenEnglishTokens: [
      'step by step',
      'stack frame',
      'however',
      'for instance',
      'scene description',
    ],
    forbiddenRoboticTokens: ['[Signs:', ':::', '**Hazards:**'],
    maxWordsPerSentence: STAGE_READABILITY_LIMITS.developing.maxAvgWordsPerSentence,
  },

  // 3. Complexity: Proficient (Bloom Level 4 - Analyze / Asymptotic Rigor)
  {
    id: 'acad_complexity_proficient',
    conceptId: 'asymptotic_complexity',
    promptFr: 'Analysez la complexité temporelle',
    bloomLevel: 4,
    cognitiveStage: 'proficient',
    expectedResponseFr: `L'analyse de la complexité temporelle évalue l'évolution du temps d'exécution d'un algorithme par rapport à la taille d'entrée $n$.
La notation grand O caractérise la borne asymptotique supérieure dans le pire des cas.
Par exemple, un parcours séquentiel s'exécute en temps linéaire $O(n)$, tandis qu'une recherche dichotomique s'exécute en temps logarithmique $O(\\log n)$.
Dans les algorithmes diviser pour régner comme le tri fusion, la relation de récurrence $T(n) = 2T(n/2) + O(n)$ conduit d'après le théorème maître à une complexité quasi-linéaire optimale en $O(n \\log n)$.`,
    keyFrenchTerms: [
      'complexité temporelle',
      'grand o',
      'borne asymptotique',
      'recherche dichotomique',
      'théorème maître',
      'pire des cas',
    ],
    forbiddenEnglishTokens: [
      'big o',
      'master theorem',
      'divide and conquer',
      'worst case',
      'step 1',
    ],
    forbiddenRoboticTokens: ['[Signs:', ':::'],
    expectedFormulas: ['O(n)', 'O(\\log n)', 'O(n \\log n)'],
    maxWordsPerSentence: STAGE_READABILITY_LIMITS.proficient.maxAvgWordsPerSentence,
  },

  // 4. Complexity: Advanced (Bloom Level 5/6 - Evaluate & Create / Industry Scale)
  {
    id: 'acad_complexity_advanced',
    conceptId: 'asymptotic_complexity',
    promptFr: 'Analysez la complexité temporelle',
    bloomLevel: 5,
    cognitiveStage: 'advanced',
    expectedResponseFr: `Dans l'ingénierie logicielle à grande échelle, l'analyse asymptotique pure en grand O doit être confrontée à la réalité matérielle des architectures modernes.
Bien qu'une table de hachage offre une complexité amortie moyenne en $O(1)$, les dégradations dues aux collisions peuvent chuter en $O(n)$ et les défauts de cache mémoire pénalisent fortement la latence réelle.
À l'inverse, un tableau contigu parcouru en $O(n)$ bénéficie du préchargement matériel et de la localité spatiale du processeur, surpassant fréquemment des structures théoriquement plus véloces sur des jeux de données de taille moyenne.
Pour concevoir des systèmes distribués résilients, nous devons systématiquement arbitrer entre le coût asymptotique théorique et la localité matérielle des accès mémoire.`,
    keyFrenchTerms: [
      'analyse asymptotique',
      'complexité amortie',
      'défauts de cache',
      'localité spatiale',
      'architectures modernes',
      'systèmes distribués',
    ],
    forbiddenEnglishTokens: [
      'cache miss',
      'trade-off',
      'hash table',
      'in summary',
      'step',
    ],
    forbiddenRoboticTokens: ['[Signs:', ':::', '**Hazards:**'],
    maxWordsPerSentence: STAGE_READABILITY_LIMITS.advanced.maxAvgWordsPerSentence,
  },
];

// ============================================================================
// 7. ARABIC QUERIES & DIALECT SWITCHING FIXTURES
// ============================================================================

export const ARABIC_QUERY_FIXTURES: ArabicQueryFixture[] = [
  {
    id: 'ar_query_keys_egyptian',
    dialect: 'egyptian',
    query: 'فين مفاتيحي؟',
    intent: 'spatial',
    expectedDialectResponse: 'آخر مرة شفت مفاتيحك كانت على ترابيزة الصالة...',
    expectedTone: 'baladi',
    pedagogicalDirective: 'Respond warmly in Egyptian Arabic referencing the coffee table in the living room.',
  },
  {
    id: 'ar_query_pointers_baladi',
    dialect: 'egyptian',
    query: 'اشرحلي المؤشرات بلغة بسيطة',
    intent: 'academic_explanation',
    expectedDialectResponse: 'المؤشر ده يا سيدي ببساطة شديدة زي عنوان بيتك المكتوب على ورقة...',
    expectedTone: 'baladi',
    pedagogicalDirective: 'Use everyday Egyptian colloquial analogies (house addresses, mailboxes), patient warmth, no jargon.',
  },
  {
    id: 'ar_query_pointers_msa',
    dialect: 'msa',
    query: 'اشرح لي مفهوم المؤشرات في لغة البرمجة بصيغة علمية',
    intent: 'academic_explanation',
    expectedDialectResponse: 'المؤشر في علم الحاسوب هو متغير مخصص لتخزين العنوان الفيزيائي لمتغير آخر في الذاكرة العشوائية...',
    expectedTone: 'formal_msa',
    pedagogicalDirective: 'Use formal Modern Standard Arabic (فصحى) with clear technical structure.',
  },
];

// ============================================================================
// 8. TRILINGUAL CONCEPT GRAPH PARITY FIXTURES
// ============================================================================

export const TRILINGUAL_CONCEPT_GRAPH: Record<string, TrilingualConceptNode> = {
  variables_types: {
    id: 'variables_types',
    nameEn: 'Variables & Data Types',
    nameAr: 'المتغيرات وأنواع البيانات',
    nameFr: 'Variables et types de données',
    domain: 'computer_science',
    difficultyTier: 1,
    prerequisites: [],
    descriptionEn: 'Basic primitives, declarations, and memory allocation.',
    descriptionAr: 'المتغيرات الأساسية وأنواعها وتخزينها في الذاكرة.',
    descriptionFr: 'Types primitifs, déclarations et allocation mémoire de base.',
  },
  control_flow: {
    id: 'control_flow',
    nameEn: 'Control Flow (Conditionals & Loops)',
    nameAr: 'التحكم في المسار (الشروط والحلقات)',
    nameFr: 'Structures de contrôle (Conditions et boucles)',
    domain: 'computer_science',
    difficultyTier: 1,
    prerequisites: ['variables_types'],
    descriptionEn: 'If-else statements, switch cases, and for/while iteration.',
    descriptionAr: 'جمل الشرط والتكرار في البرمجة.',
    descriptionFr: 'Instructions conditionnelles et boucles d’itération.',
  },
  functions: {
    id: 'functions',
    nameEn: 'Functions & Scope',
    nameAr: 'الدوال ونطاق المتغيرات',
    nameFr: 'Fonctions et portée des variables',
    domain: 'computer_science',
    difficultyTier: 2,
    prerequisites: ['control_flow'],
    descriptionEn: 'Parameters, return values, call stack, and variable scope.',
    descriptionAr: 'تمرير المعاملات، القيم المرجعة، ونطاق الرؤية.',
    descriptionFr: 'Paramètres, valeurs de retour, pile d’appels et portée.',
  },
  pointers: {
    id: 'pointers',
    nameEn: 'Pointers & Dereferencing',
    nameAr: 'المؤشرات والوصول المباشر (Dereferencing)',
    nameFr: 'Pointeurs et déréférencement',
    domain: 'computer_science',
    difficultyTier: 3,
    prerequisites: ['variables_types'],
    descriptionEn: 'Pointer variables, address-of operator (&), and dereference (*).',
    descriptionAr: 'تخزين عناوين الذاكرة والتعامل مع المؤشرات وعامل فك الإشارة.',
    descriptionFr: 'Variables pointeurs, opérateur d’adresse (&) et déréférencement (*).',
  },
  recursion: {
    id: 'recursion',
    nameEn: 'Recursion & Call Stack Depth',
    nameAr: 'الاستدعاء الذاتي ومكدس النداء',
    nameFr: 'Récursion et profondeur de pile',
    domain: 'computer_science',
    difficultyTier: 3,
    prerequisites: ['functions'],
    descriptionEn: 'Base cases, recursive steps, and stack overflow avoidance.',
    descriptionAr: 'الحالات الأساسية، خطوات العودية، ومنع امتلاء المكدس.',
    descriptionFr: 'Cas de base, étapes récursives et prévention des dépassements de pile.',
  },
  asymptotic_complexity: {
    id: 'asymptotic_complexity',
    nameEn: 'Asymptotic Complexity (Big-O Notation)',
    nameAr: 'التعقيد الحسابي (Big-O)',
    nameFr: 'Complexité asymptotique (Notation Grand O)',
    domain: 'computer_science',
    difficultyTier: 3,
    prerequisites: ['control_flow', 'functions'],
    descriptionEn: 'Time and space complexity analysis for algorithms.',
    descriptionAr: 'تحليل زمن التنفيذ واستهلاك الذاكرة للخوارزميات.',
    descriptionFr: 'Analyse de la complexité temporelle et spatiale des algorithmes.',
  },
  dynamic_memory: {
    id: 'dynamic_memory',
    nameEn: 'Dynamic Memory Allocation (malloc / new / free)',
    nameAr: 'تخصيص الذاكرة الديناميكية',
    nameFr: 'Allocation dynamique de mémoire (malloc / new / free)',
    domain: 'computer_science',
    difficultyTier: 4,
    prerequisites: ['pointers'],
    descriptionEn: 'Runtime allocation, pointer casting, and avoiding memory leaks.',
    descriptionAr: 'حجز الذاكرة أثناء وقت التشغيل، وتفادي تسريب الذاكرة.',
    descriptionFr: 'Allocation à l’exécution, arithmétique de pointeurs et fuites mémoire.',
  },
};

// ============================================================================
// 9. CONVERSATIONAL STRAIN DETECTION TRILINGUAL FIXTURES
// ============================================================================

export const TRILINGUAL_STRAIN_FIXTURES = {
  fr: [
    { text: "je ne comprends pas du tout ce concept", expectedConfused: true, expectedSeverity: 'mild' as const },
    { text: "je ne comprends pas, c'est trop compliqué", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "ce n'est pas clair, peux-tu m'expliquer pas à pas ?", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "pourquoi donc ce pointeur pointe vers nulle part ?", expectedConfused: true, expectedSeverity: 'mild' as const },
  ],
  ar: [
    { text: "مش فاهم حاجة خالص", expectedConfused: true, expectedSeverity: 'mild' as const },
    { text: "مش فاهم حاجة، دي صعبة اوي ولخبطتني", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "مش فاهمة، ممكن تبسطهالي خطوة بخطوة ؟", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "ليه كده وازاي ده حصل؟", expectedConfused: true, expectedSeverity: 'mild' as const },
  ],
  en: [
    { text: "i don't get this at all", expectedConfused: true, expectedSeverity: 'mild' as const },
    { text: "i don't understand and this is so confusing", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "can you simplify and explain step by step please?", expectedConfused: true, expectedSeverity: 'severe' as const },
    { text: "wait why did that happen?", expectedConfused: true, expectedSeverity: 'mild' as const },
  ],
};

// ============================================================================
// 10. AUDIO SPEECH SANITIZATION FIXTURES (cleanForSpeech)
// ============================================================================

export const SPEECH_SANITIZATION_FIXTURES = {
  fr: {
    raw: `[Signs:HELLO] **Description de la scène:** Devant vous se trouve un passage piéton.
**Dangers:** Aucun danger détecté autour de vous.
**Textes visibles:** Aucun.
Pour programmer, nous utilisons **C++** et **C#**.
* Premier point à retenir
* Deuxième point`,
    expectedCleanSnippet: "Devant vous se trouve un passage piéton. Aucun danger autour de vous. Pour programmer, nous utilisons C plus plus et C sharp. Premier point à retenir Deuxième point",
  },
  ar: {
    raw: `[Signs:GREETING] **وصف المشهد:** أنت في غرفة المعيشة.
**المخاطر:** لا توجد أخطار في محيطك.
**النصوص المكتوبة:** لا توجد نصوص.
المؤشر في لغة C++ استريك مهم جداً.
- الخطوة الأولى
- الخطوة الثانية`,
    expectedCleanSnippet: "أنت في غرفة المعيشة. مفيش أخطار حواليك. المؤشر في لغة C plus plus مهم جداً. الخطوة الأولى الخطوة الثانية",
  },
  en: {
    raw: `[Signs:WAVE] **Scene Description:** You are in the kitchen.
**Hazards:** None detected around you.
**Visible Text:** None.
We write code in **C++** and **C#**.
- Step one
- Step two`,
    expectedCleanSnippet: "You are in the kitchen. No hazards around you. We write code in C plus plus and C sharp. Step one Step two",
  },
};

// ============================================================================
// 11. EVALUATION RUBRICS & HELPER EVALUATORS
// ============================================================================

export const EVALUATION_RUBRICS: Record<string, EvaluationRubricCriteria> = {
  frenchGrammarAndTone: {
    weight: 0.25,
    description: 'French grammar accuracy, proper diacritics, polite address (vouvoiement/politesse), zero stylistic harshness.',
    passingThreshold: 0.95,
  },
  cognitiveScaffolding: {
    weight: 0.25,
    description: "Pedagogical alignment with student's cognitive stage and Bloom's taxonomy, adhering to sentence length limits.",
    passingThreshold: 0.90,
  },
  personaAndEmergencyMatching: {
    weight: 0.20,
    description: 'French travel persona injection (Golden Etiquette) and 100% emergency hotkey quick-dial matching accuracy.',
    passingThreshold: 1.0,
  },
  spatialHonestyAndResolution: {
    weight: 0.15,
    description: 'Accurate French spatial memory location reporting and strict epistemic honesty qualifiers when stale.',
    passingThreshold: 1.0,
  },
  trilingualParity: {
    weight: 0.15,
    description: '1:1 trilingual parity across concept graph labels, strain detection triggers, and audio speech sanitization.',
    passingThreshold: 1.0,
  },
};

/**
 * Checks for English word leaks in French text.
 */
export function detectEnglishLeaks(text: string): { leakCount: number; leakedTokens: string[] } {
  const commonEnglishTokens = [
    /\bstep\s*\d+/i,
    /\bhowever\b/i,
    /\bin summary\b/i,
    /\bfor example\b/i,
    /\bfor instance\b/i,
    /\bfirst of all\b/i,
    /\blet'?s\s+(break|look|dive)\b/i,
    /\bnext,\b/i,
    /\bas an ai\b/i,
    /\bscene description\b/i,
    /\bvisible text\b/i,
    /\bnone detected\b/i,
    /\bhazards\b/i,
    /\bbase case\b/i,
    /\brecursive step\b/i,
    /\bcall stack\b/i,
    /\bdivide and conquer\b/i,
    /\bbig o\b/i,
    /\bworst case\b/i,
    /\bmaster theorem\b/i,
  ];

  const leaked: string[] = [];
  for (const token of commonEnglishTokens) {
    const match = text.match(token);
    if (match) {
      leaked.push(match[0]);
    }
  }

  return {
    leakCount: leaked.length,
    leakedTokens: leaked,
  };
}

/**
 * Checks for robotic or unparsed tokens (e.g. sign markers, unclosed tags, vision headers).
 */
export function detectRoboticTokens(text: string): { leakCount: number; leakedTokens: string[] } {
  const roboticPatterns = [
    /\[Signs:[^\]]*\]/i,
    /:::[a-z_-]*/i,
    /\*\*Hazards:\*\*/i,
    /\*\*Visible Text:\*\*/i,
    /\*\*Description de la scène:\*\*/i,
    /None detected/i,
  ];

  const leaked: string[] = [];
  for (const pat of roboticPatterns) {
    const match = text.match(pat);
    if (match) {
      leaked.push(match[0]);
    }
  }

  return {
    leakCount: leaked.length,
    leakedTokens: leaked,
  };
}

/**
 * Evaluates French grammar, polite tone, and absence of English or robotic leaks.
 */
export function evaluateFrenchGrammarAndTone(text: string): {
  passes: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Check English leaks
  const englishCheck = detectEnglishLeaks(text);
  if (englishCheck.leakCount > 0) {
    issues.push(`English leaks detected (${englishCheck.leakCount}): ${englishCheck.leakedTokens.join(', ')}`);
  }

  // Check Robotic leaks
  const roboticCheck = detectRoboticTokens(text);
  if (roboticCheck.leakCount > 0) {
    issues.push(`Robotic tokens detected (${roboticCheck.leakCount}): ${roboticCheck.leakedTokens.join(', ')}`);
  }

  // Check essential French diacritics / orthography
  const hasFrenchDiacritics = /[éèêëàâîïôûùçœæÉÈÊÀÂÎÏÔÛÙÇ]/i.test(text);
  if (!hasFrenchDiacritics && text.length > 40) {
    issues.push('Missing French diacritics (accents), suggesting unlocalized or ASCII text.');
  }

  const score = issues.length === 0 ? 1.0 : Math.max(0, 1.0 - issues.length * 0.25);
  return {
    passes: issues.length === 0,
    score,
    issues,
  };
}

/**
 * Evaluates pedagogical readability compliance against the specified CognitiveStage.
 */
export function evaluateCognitiveStageScaffolding(
  text: string,
  stage: CognitiveStage,
  bloomLevel?: BloomLevel
): {
  compliant: boolean;
  avgWordsPerSentence: number;
  stageLimit: number;
  details: string;
} {
  const metric = calculateCognitiveComplexity(text, stage);
  const stageLimit = STAGE_READABILITY_LIMITS[stage].maxAvgWordsPerSentence;
  const compliant = metric.avgWordsPerSentence <= stageLimit;

  let details = `Avg words/sentence: ${metric.avgWordsPerSentence} (Max allowed for ${stage}: ${stageLimit}).`;
  if (bloomLevel) {
    const bInfo = BLOOM_TAXONOMY[bloomLevel];
    details += ` Target Bloom Level: ${bloomLevel} (${bInfo.nameFr} / ${bInfo.nameEn}).`;
  }

  return {
    compliant,
    avgWordsPerSentence: metric.avgWordsPerSentence,
    stageLimit,
    details,
  };
}

/**
 * Matches an emergency query in French, Arabic, or English to the official French emergency hotkey.
 */
export function matchEmergencyService(query: string): EmergencyServiceFixture | null {
  const lower = query.toLowerCase().trim();

  // 114 (SMS Urgence / Sourds)
  if (
    lower.includes('114') ||
    lower.includes('sourd') ||
    lower.includes('sourde') ||
    lower.includes('malentendant') ||
    lower.includes('sms urgence') ||
    lower.includes('صم') ||
    lower.includes('deaf')
  ) {
    return EMERGENCY_SERVICES_FIXTURES.find((s) => s.number === '114') || null;
  }

  // 18 (Pompiers / Fire & Road rescue)
  if (
    lower.includes('18') ||
    lower.includes('pompier') ||
    lower.includes('incendie') ||
    lower.includes('feu') ||
    lower.includes('gaz') ||
    lower.includes('accident de la route') ||
    lower.includes('مطافئ') ||
    lower.includes('حريق') ||
    lower.includes('fire')
  ) {
    return EMERGENCY_SERVICES_FIXTURES.find((s) => s.number === '18') || null;
  }

  // 17 (Police Secours)
  if (
    lower.includes('17') ||
    lower.includes('police') ||
    lower.includes('volé') ||
    lower.includes('vol') ||
    lower.includes('agression') ||
    lower.includes('cambriolage') ||
    lower.includes('شرطة') ||
    lower.includes('سرقة') ||
    lower.includes('robbery') ||
    lower.includes('assault')
  ) {
    return EMERGENCY_SERVICES_FIXTURES.find((s) => s.number === '17') || null;
  }

  // 112 (European emergency line)
  if (
    lower.includes('112') ||
    lower.includes('européen') ||
    lower.includes('europe') ||
    lower.includes('english speaking') ||
    lower.includes('english') ||
    lower.includes('الأوروبي')
  ) {
    return EMERGENCY_SERVICES_FIXTURES.find((s) => s.number === '112') || null;
  }

  // 15 (SAMU / Urgences Médicales)
  if (
    lower.includes('15') ||
    lower.includes('samu') ||
    lower.includes('médicale') ||
    lower.includes('medicale') ||
    lower.includes('ambulance') ||
    lower.includes('malaise') ||
    lower.includes('respire plus') ||
    lower.includes('hôpital') ||
    lower.includes('hopital') ||
    lower.includes('إسعاف') ||
    lower.includes('طوارئ طبية') ||
    lower.includes('medical')
  ) {
    return EMERGENCY_SERVICES_FIXTURES.find((s) => s.number === '15') || null;
  }

  return null;
}

/**
 * Evaluates epistemic honesty qualifiers in spatial memory responses.
 */
export function evaluateSpatialHonesty(
  response: string,
  isStale: boolean,
  lang: LanguageCode = 'fr'
): { hasHonestyDisclaimer: boolean; isAccurate: boolean } {
  const lower = response.toLowerCase();

  if (lang === 'fr') {
    const hasDisclaimer =
      lower.includes('remarque') &&
      (lower.includes('déplacé') || lower.includes('temps'));
    return {
      hasHonestyDisclaimer: hasDisclaimer,
      isAccurate: isStale ? hasDisclaimer : !hasDisclaimer,
    };
  }

  if (lang === 'ar') {
    const hasDisclaimer =
      lower.includes('ملاحظة') &&
      (lower.includes('تحريكه') || lower.includes('الوقت'));
    return {
      hasHonestyDisclaimer: hasDisclaimer,
      isAccurate: isStale ? hasDisclaimer : !hasDisclaimer,
    };
  }

  const hasDisclaimer =
    lower.includes('note') &&
    (lower.includes('moved') || lower.includes('passed'));
  return {
    hasHonestyDisclaimer: hasDisclaimer,
    isAccurate: isStale ? hasDisclaimer : !hasDisclaimer,
  };
}

/**
 * Validates trilingual parity across concept graph, strain triggers, and cleanForSpeech.
 */
export function validateTrilingualParity(): {
  conceptGraphParity: boolean;
  strainParity: boolean;
  speechSanitizationParity: boolean;
  totalConceptsChecked: number;
} {
  // 1. Concept Graph Parity
  const conceptKeys = Object.keys(TRILINGUAL_CONCEPT_GRAPH);
  let conceptGraphParity = true;

  for (const k of conceptKeys) {
    const c = TRILINGUAL_CONCEPT_GRAPH[k];
    if (!c.nameEn || !c.nameAr || !c.nameFr || !c.descriptionEn || !c.descriptionAr || !c.descriptionFr) {
      conceptGraphParity = false;
      break;
    }
  }

  // 2. Conversational Strain Parity
  let strainParity = true;
  for (const lang of ['fr', 'ar', 'en'] as const) {
    for (const fixture of TRILINGUAL_STRAIN_FIXTURES[lang]) {
      const res = detectConversationalStrain(fixture.text);
      if (res.isConfused !== fixture.expectedConfused || res.severity !== fixture.expectedSeverity) {
        strainParity = false;
        break;
      }
    }
  }

  // 3. Audio Speech Sanitization Parity
  let speechSanitizationParity = true;
  for (const lang of ['fr', 'ar', 'en'] as const) {
    const fixture = SPEECH_SANITIZATION_FIXTURES[lang];
    const cleaned = cleanForSpeech(fixture.raw);
    if (cleaned.includes('[Signs:') || cleaned.includes('**') || cleaned.includes('None detected')) {
      speechSanitizationParity = false;
      break;
    }
  }

  return {
    conceptGraphParity,
    strainParity,
    speechSanitizationParity,
    totalConceptsChecked: conceptKeys.length,
  };
}
