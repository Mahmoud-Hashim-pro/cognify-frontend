/**
 * Contextual AAC Prediction Engine
 * Provides context-aware quick conversational phrases for motor-impaired / ALS users
 * based on the time of day, location, and communicative intent.
 */

export interface ContextualPhrase {
  id: string;
  textAr: string;
  textEn: string;
  textFr: string;
  category: 'urgent' | 'comfort' | 'food' | 'social' | 'medical';
  icon: string;
}

export function getContextualPhrases(
  date: Date = new Date(),
  activeCategory?: string
): ContextualPhrase[] {
  const hour = date.getHours();

  // Time of day classification
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening = hour >= 17 && hour < 22;
  const isNight = hour >= 22 || hour < 5;

  const allPhrases: ContextualPhrase[] = [];

  // Urgent always available
  allPhrases.push(
    {
      id: 'urg_help',
      textAr: 'محتاج مساعدة ضروري لو سمحت',
      textEn: 'I need urgent help please',
      textFr: "J'ai besoin d'aide urgente s'il vous plaît",
      category: 'urgent',
      icon: '🚨',
    },
    {
      id: 'urg_water',
      textAr: 'عايز أشرب مية',
      textEn: 'I want some water',
      textFr: 'Je veux boire de l’eau',
      category: 'comfort',
      icon: '💧',
    }
  );

  if (isMorning) {
    allPhrases.push(
      {
        id: 'time_morn',
        textAr: 'صباح الخير',
        textEn: 'Good morning',
        textFr: 'Bonjour',
        category: 'social',
        icon: '🌅',
      },
      {
        id: 'morn_breakfast',
        textAr: 'عايز أفطر دلوقتي',
        textEn: 'I would like breakfast now',
        textFr: 'Je voudrais prendre mon petit déjeuner',
        category: 'food',
        icon: '🍳',
      },
      {
        id: 'morn_meds',
        textAr: 'ميعاد دواء الصباح',
        textEn: 'Time for morning medicine',
        textFr: 'C’est l’heure de mes médicaments du matin',
        category: 'medical',
        icon: '💊',
      }
    );
  } else if (isAfternoon) {
    allPhrases.push(
      {
        id: 'aft_lunch',
        textAr: 'عايز أتغدى',
        textEn: 'I would like lunch',
        textFr: 'Je voudrais déjeuner',
        category: 'food',
        icon: '🍲',
      },
      {
        id: 'aft_rest',
        textAr: 'عايز أرتاح شوية',
        textEn: 'I need to rest a bit',
        textFr: 'Je voudrais me reposer un peu',
        category: 'comfort',
        icon: '🛋️',
      }
    );
  } else if (isEvening) {
    allPhrases.push(
      {
        id: 'eve_dinner',
        textAr: 'عايز أتعشى خفيف',
        textEn: 'I would like a light dinner',
        textFr: 'Je voudrais un dîner léger',
        category: 'food',
        icon: '🥣',
      },
      {
        id: 'eve_tv',
        textAr: 'ممكن تشغل التلفزيون؟',
        textEn: 'Could you turn on the TV?',
        textFr: 'Pouvez-vous allumer la télé ?',
        category: 'social',
        icon: '📺',
      }
    );
  } else {
    allPhrases.push(
      {
        id: 'ngt_sleep',
        textAr: 'عايز أنام، تصبحوا على خير',
        textEn: 'I want to sleep, good night',
        textFr: 'Je veux dormir, bonne nuit',
        category: 'comfort',
        icon: '🌙',
      },
      {
        id: 'ngt_light',
        textAr: 'اطفئ النور من فضلك',
        textEn: 'Please turn off the lights',
        textFr: 'Éteignez la lumière s’il vous plaît',
        category: 'comfort',
        icon: '💡',
      }
    );
  }

  // Common physical comfort requests
  allPhrases.push(
    {
      id: 'comf_adjust',
      textAr: 'عايز أعدل وضعي أو الكرسي',
      textEn: 'Please adjust my position or chair',
      textFr: 'Ajustez ma position ou le fauteuil s’il vous plaît',
      category: 'comfort',
      icon: '🦽',
    },
    {
      id: 'comf_pain',
      textAr: 'حاسس بألم ومحتاج مسكن',
      textEn: 'I feel pain and need a painkiller',
      textFr: 'Je ressens une douleur et ai besoin d’un calmant',
      category: 'medical',
      icon: '🩺',
    },
    {
      id: 'soc_thanks',
      textAr: 'شكراً جزيلاً، تسلم إيدك',
      textEn: 'Thank you very much',
      textFr: 'Merci beaucoup',
      category: 'social',
      icon: '🙏',
    },
    {
      id: 'soc_yes',
      textAr: 'أيوه، تمام',
      textEn: 'Yes, exactly',
      textFr: 'Oui, tout à fait',
      category: 'social',
      icon: '✅',
    },
    {
      id: 'soc_no',
      textAr: 'لا، مش كده',
      textEn: 'No, not like that',
      textFr: 'Non, pas comme ça',
      category: 'social',
      icon: '❌',
    }
  );

  if (activeCategory) {
    return allPhrases.filter((p) => p.category === activeCategory);
  }

  return allPhrases;
}
