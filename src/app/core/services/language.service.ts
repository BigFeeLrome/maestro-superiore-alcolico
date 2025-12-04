import { Injectable, signal, computed } from '@angular/core';

export type Language = 'IT' | 'EN';

const DICTIONARY = {
  IT: {
    // Landing
    landing_subtitle: 'Sistema di Intelligenza Mixologica',
    enter_lab: 'Entra nel Laboratorio',
    landing_mode_single: 'Signature Serve',
    landing_desc_single: 'Progettazione di un Singolo Cocktail d\'Autore',
    landing_mode_menu: 'Drink Flight',
    landing_desc_menu: 'Sviluppo di una Drink List Completa',
    landing_mode_analysis: 'Bar Audit',
    landing_desc_analysis: 'Analisi Strategica di Menu Esistenti',
    landing_mode_calculator: 'Calcolatore Diluizione',
    landing_desc_calculator: 'Calcolo Precisione Riduzione Gradazione',

    // Calculator
    calc_title: 'Calcolatore di Diluizione',
    calc_subtitle: 'Calcola l\'acqua necessaria per ridurre la gradazione',
    calc_form_title: 'Parametri di Diluizione',
    calc_initial_volume: 'Volume Iniziale (ml)',
    calc_initial_abv: 'Gradazione Attuale (%)',
    calc_target_abv: 'Gradazione Target (%)',
    calc_calculate: 'Calcola',
    calc_loading: 'Consultando il Maestro...',
    calc_results: 'Risultati',
    calc_water_to_add: 'Acqua da Aggiungere',
    calc_final_volume: 'Volume Finale',
    calc_download_pdf: 'Scarica Report PDF',
    calc_maestro_says: 'Il Maestro Alcolico dice:',
    calc_consulting: 'Il Maestro sta formulando il suo consiglio...',

    // Header & Nav
    back_home: 'HOME',
    dashboard_title: 'Laboratorio Alchemico',
    
    // Input Wizard / Chat
    wizard_title: 'Laboratorio Alchemico',
    wizard_expertise_label: 'Livello Mixology',
    wizard_placeholder: 'Descrivi il profilo aromatico...',
    wizard_thinking: 'Miscelazione in corso...',
    wizard_materialize: 'Distilla Concetto',
    wizard_solidifying: 'Cristallizzazione...',
    chat_system_welcome: 'Benvenuto. Sono il Maestro Mixologist. Definiamo il liquido. Quale spirito o emozione esploriamo oggi?',
    chat_system_error: 'La connessione è debole. Riprova.',
    chat_system_handoff_error: 'Ho difficoltà a bilanciare la ricetta. Possiamo riassumere gli spiriti base?',
    
    // Menu Workspace
    menu_ws_title: 'Atelier del Bar',
    menu_ws_courses: 'Drink',
    menu_ws_concept: 'Filo Conduttore',
    menu_ws_chat_placeholder: 'Discuti modifiche (es. "Rendi il secondo drink più acido...")',
    btn_view_course: 'Esamina',
    btn_back_to_menu: 'Torna alla List',
    btn_regenerate_course: 'Rigenera Drink',
    btn_undo_last: 'Annulla Modifica',
    btn_export_pdf: 'Esporta PDF Barman',
    btn_analyze_menu: 'Analisi Pour Cost',
    msg_updating_menu: 'Il Maestro sta rielaborando la drink list...',
    msg_regenerating_dish: 'Rielaborazione cocktail in corso...',
    msg_analyzing_costs: 'Ricerca prezzi bottiglie in corso...',
    
    // Menu Analysis Report
    ma_report_title: 'Business Plan Bar',
    ma_total_cost: 'Pour Cost Totale',
    ma_rec_price: 'Prezzo Vendita (Pax)',
    ma_margin: 'Margine',
    ma_breakdown_title: 'Dettaglio Drink',
    ma_dish: 'Cocktail',
    ma_cost: 'Costo Liquido',
    ma_exp_ing: 'Spiriti Premium',

    // Menu Analysis Component (New)
    ana_title: 'Consulenza Strategica',
    ana_subtitle: 'Carica un menu o fornisci un URL per un\'analisi AI allineata alla tua Brand Identity.',
    ana_upload_label: 'Carica Menu (PDF/IMG)',
    ana_url_label: 'URL Sito Web (Opzionale)',
    ana_analyze_btn: 'Avvia Bar Audit',
    ana_analyzing: 'Analisi identità e studio dei drink in corso...',
    ana_profile_title: 'Profilo Identitario Rilevato',
    ana_identity: 'Identità',
    ana_vibe: 'Percezione Esterna',
    ana_target: 'Target',
    ana_table_dish: 'Drink Rilevato',
    ana_table_critique: 'Analisi Critica',
    ana_table_improvement: 'Suggerimento Evolutivo',
    ana_table_score: 'Allineamento',
    ana_table_actions: 'Azioni',
    ana_btn_regenerate: 'Genera Alternativa',
    ana_btn_create_recipe: 'Crea Ricetta',
    ana_btn_export_pdf: 'Esporta Report PDF',
    ana_global_critique: 'Valutazione Globale',
    ana_opportunities: 'Opportunità Strategiche',
    
    // FILTERS - HEADERS
    filter_cat_diet: 'Alcol & Potenza',
    filter_cat_tech: 'Metodo & Prep',
    filter_cat_mood: 'Vibe & Era',
    filter_cat_log: 'Base & Texture',
    filter_active_label: 'Direttive Attive',

    // GROUP 1: POTENCY (Was Diet)
    grp1_virgin: 'Analcolico (Virgin)',
    grp1_low_abv: 'Low-ABV / Session',
    grp1_spirit_forward: 'Spirit Forward',
    grp1_overproof: 'Overproof / Navy Strength',
    grp1_sour: 'Sour Style',
    grp1_fizz: 'Fizz / Highball',
    grp1_punch: 'Punch',
    grp1_bitter: 'Amaro / Bitter',
    grp1_sweet: 'Dolce / Dessert',
    grp1_savory: 'Savory / Umami',

    // GROUP 2: METHOD (Was Technique)
    grp2_shaken: 'Shaken',
    grp2_stirred: 'Stirred',
    grp2_thrown: 'Thrown',
    grp2_built: 'Built in Glass',
    grp2_blended: 'Blended / Frozen',
    grp2_clarified: 'Milk Washing / Clarified',
    grp2_fat_washed: 'Fat-Washed',
    grp2_smoked: 'Affumicato / Smoked',
    grp2_carbonated: 'Carbonated / Siphon',
    grp2_spherified: 'Molecolare',

    // GROUP 3: MOOD (Was Mood)
    grp3_speakeasy: 'Speakeasy / Prohibition',
    grp3_tiki: 'Tiki / Tropical',
    grp3_aperitivo: 'Aperitivo Italiano',
    grp3_digestivo: 'Digestivo / After Dinner',
    grp3_disco: 'Disco Drink (80s)',
    grp3_minimalist: 'Minimalista / Lab',
    grp3_classic: 'Modern Classic',
    grp3_avant_garde: 'Avanguardia',
    grp3_hotel_bar: 'Grand Hotel Bar',
    grp3_dive_bar: 'Elevated Dive Bar',

    // GROUP 4: BASE (Was Logistics)
    grp4_gin: 'Gin Based',
    grp4_agave: 'Agave (Tequila/Mezcal)',
    grp4_whiskey: 'Whiskey / Bourbon',
    grp4_rum: 'Rum / Cane',
    grp4_vodka: 'Vodka / Neutral',
    grp4_brandy: 'Brandy / Cognac',
    grp4_amaro: 'Amaro Based',
    grp4_wine: 'Wine / Champagne',
    grp4_zero_waste: 'Zero Waste',
    grp4_foraged: 'Foraging / Locale',

    // Expertise
    exp_beginner: 'Home Bartender',
    exp_teacher: 'Bar Trainer',
    exp_enthusiast: 'Appassionato',
    exp_pro: 'Bar Manager',

    // Loading States
    loading_materializing: 'Distillando la tua Visione...',
    loading_maestro_cooking: 'Il Maestro è al bancone...',
    error_title: 'Bicchiere Rotto',
    error_desc: 'Il Consiglio dei Saggi non ha raggiunto un consenso. Per favore affina la tua richiesta.',
    btn_retry: 'Riprova',
    btn_new_commission: 'Nuova Commissione',

    // Recipe View
    meta_execution: 'PREP',
    section_rationale: 'Filosofia',
    section_mise_en_place: 'Station Setup',
    section_preparation: 'Costruzione',
    section_toolkit: 'Toolkit Strategico',
    section_homemade: 'Preparazioni Home-made',
    section_nutrition: 'Profilo Alcolico & Energetico',
    nutr_calories: 'Calorie Totali',
    nutr_abv: 'Gradazione Alcolica (Diluito)',
    btn_gen_photo: 'Genera Foto',
    btn_download: 'Scarica Copia Barman',
    btn_export_code: 'Esporta Codice Ricetta',
    tip_label: 'Pro Tip',
    
    // PDF Columns
    col_ingredient: 'Ingrediente',
    col_qty: 'Quantità',
    col_price: 'Prezzo Mercato',
    col_cost: 'Costo',
    col_trend: 'Trend',
    col_abv: 'ABV %',
    col_calories: 'Calorie (Kcal)',

    // Sages
    sages_intro: 'Ecco il responso del Consiglio dei Saggi per il tuo drink:',
    sage_scientist: 'Lo Scienziato',
    sage_artist: 'L\'Artista',
    sage_historian: 'Lo Storico',
    sage_philosopher: 'Il Filosofo',

    // Market Analysis (Single Drink)
    ma_single_title: 'Analisi Granulare Pour Cost & Profilo Nutrizionale',
    ma_single_calculating: 'Analisi Pour Cost e valori nutrizionali in corso...',
    market_title: 'Analisi di Mercato',
    market_margin: 'Margine',
    market_export: 'Esporta Report',
    market_total_cost: 'Costo Totale',
    market_sugg_price: 'Prezzo Suggerito',
    market_narrative: 'Strategia Commerciale',

    // Photo Prompt
    photo_title: 'Maestro Visual Studio',
    photo_subtitle: 'Powered by Google Imagen',
    photo_label: 'Prompt Engineering (English)',
    photo_copy: 'Copia',
    photo_export_md: 'Esporta (MD)',
    photo_copied: 'Copiato!',
    photo_placeholder: 'In attesa della visione del Maestro...',
    photo_render: 'Renderizza Visualizzazione',
    photo_developing: 'Sviluppo Pellicola...',
    photo_awaiting: 'In attesa di Render',
    photo_processing: 'Elaborazione Imagen...',
    
    // New Photo Buttons
    photo_btn_regenerate: 'Rigenera',
    photo_btn_download: 'Scarica Immagine',
    photo_btn_insert: 'Inserisci nella Ricetta',
    photo_btn_close: 'Torna alla Ricetta',
  },
  EN: {
    // Landing
    landing_subtitle: 'Mixology Intelligence System',
    enter_lab: 'Enter the Laboratory',
    landing_mode_single: 'Signature Serve',
    landing_desc_single: 'Design of a Single Masterpiece Cocktail',
    landing_mode_menu: 'Drink Flight',
    landing_desc_menu: 'Development of a Full Beverage Program',
    landing_mode_analysis: 'Bar Audit',
    landing_desc_analysis: 'Strategic Audit of Existing Menus',
    landing_mode_calculator: 'Dilution Calculator',
    landing_desc_calculator: 'Precise ABV Reduction Calculation',

    // Calculator
    calc_title: 'Dilution Calculator',
    calc_subtitle: 'Calculate water needed to reduce alcohol content',
    calc_form_title: 'Dilution Parameters',
    calc_initial_volume: 'Initial Volume (ml)',
    calc_initial_abv: 'Current ABV (%)',
    calc_target_abv: 'Target ABV (%)',
    calc_calculate: 'Calculate',
    calc_loading: 'Consulting the Maestro...',
    calc_results: 'Results',
    calc_water_to_add: 'Water to Add',
    calc_final_volume: 'Final Volume',
    calc_download_pdf: 'Download PDF Report',
    calc_maestro_says: 'The Alcohol Maestro says:',
    calc_consulting: 'The Maestro is formulating advice...',

    // Header & Nav
    back_home: 'HOME',
    dashboard_title: 'Alchemical Laboratory',
    
    // Input Wizard / Chat
    wizard_title: 'Alchemical Laboratory',
    wizard_expertise_label: 'Expertise Level',
    wizard_placeholder: 'Describe the flavor profile...',
    wizard_thinking: 'Thinking...',
    wizard_materialize: 'Materialize Vision',
    wizard_solidifying: 'Solidifying...',
    chat_system_welcome: 'Welcome. I am Maestro Mixologist. Let us define the liquid together. What spirit or emotion shall we explore?',
    chat_system_error: 'The connection to the Sages is faint. Please try again.',
    chat_system_handoff_error: 'I am having trouble balancing the recipe. Could we summarize the base spirits one last time?',

    // Menu Workspace
    menu_ws_title: 'Bar Atelier',
    menu_ws_courses: 'Drinks',
    menu_ws_concept: 'Thematic Thread',
    menu_ws_chat_placeholder: 'Discuss adjustments (e.g. "Make the second drink more acidic...")',
    btn_view_course: 'Examine',
    btn_back_to_menu: 'Back to Menu',
    btn_regenerate_course: 'Regenerate Drink',
    btn_undo_last: 'Undo Change',
    btn_export_pdf: 'Export Barman PDF',
    btn_analyze_menu: 'Financial Analysis',
    msg_updating_menu: 'The Maestro is refining the drink list...',
    msg_regenerating_dish: 'Regenerating cocktail...',
    msg_analyzing_costs: 'Querying bottle prices...',

    // Menu Analysis Report
    ma_report_title: 'Bar Business Plan',
    ma_total_cost: 'Total Pour Cost',
    ma_rec_price: 'Sale Price (Pax)',
    ma_margin: 'Margin',
    ma_breakdown_title: 'Drink Breakdown',
    ma_dish: 'Cocktail',
    ma_cost: 'Pour Cost',
    ma_exp_ing: 'Premium Spirits',

    // Menu Analysis Component (New)
    ana_title: 'Strategic Consultancy',
    ana_subtitle: 'Upload a menu or provide a URL for AI analysis aligned with your Brand Identity.',
    ana_upload_label: 'Upload Menu (PDF/IMG)',
    ana_url_label: 'Website URL (Optional)',
    ana_analyze_btn: 'Start Bar Audit',
    ana_analyzing: 'Analyzing identity and studying the menu...',
    ana_profile_title: 'Identity Profile Detected',
    ana_identity: 'Identity',
    ana_vibe: 'External Perception',
    ana_target: 'Target',
    ana_table_dish: 'Detected Drink',
    ana_table_critique: 'Critical Analysis',
    ana_table_improvement: 'Evolutionary Suggestion',
    ana_table_score: 'Alignment',
    ana_table_actions: 'Actions',
    ana_btn_regenerate: 'Create Alternative',
    ana_btn_create_recipe: 'Create Recipe',
    ana_btn_export_pdf: 'Export Report PDF',
    ana_global_critique: 'Global Assessment',
    ana_opportunities: 'Strategic Opportunities',

    // FILTERS - HEADERS
    filter_cat_diet: 'Alcohol & Potency',
    filter_cat_tech: 'Method & Prep',
    filter_cat_mood: 'Vibe & Era',
    filter_cat_log: 'Base & Texture',
    filter_active_label: 'Active Directives',

    // GROUP 1: POTENCY
    grp1_virgin: 'Virgin / Zero Proof',
    grp1_low_abv: 'Low-ABV / Session',
    grp1_spirit_forward: 'Spirit Forward',
    grp1_overproof: 'Overproof / Navy',
    grp1_sour: 'Sour Style',
    grp1_fizz: 'Fizz / Highball',
    grp1_punch: 'Punch',
    grp1_bitter: 'Amaro / Bitter',
    grp1_sweet: 'Sweet / Dessert',
    grp1_savory: 'Savory / Umami',

    // GROUP 2: METHOD
    grp2_shaken: 'Shaken',
    grp2_stirred: 'Stirred',
    grp2_thrown: 'Thrown',
    grp2_built: 'Built in Glass',
    grp2_blended: 'Blended / Frozen',
    grp2_clarified: 'Milk Washing / Clarified',
    grp2_fat_washed: 'Fat-Washed',
    grp2_smoked: 'Smoked',
    grp2_carbonated: 'Carbonated / Siphon',
    grp2_spherified: 'Molecular',

    // GROUP 3: MOOD
    grp3_speakeasy: 'Speakeasy / Prohibition',
    grp3_tiki: 'Tiki / Tropical',
    grp3_aperitivo: 'Aperitivo Italiano',
    grp3_digestivo: 'Digestivo / After Dinner',
    grp3_disco: 'Disco Drink (80s)',
    grp3_minimalist: 'Minimalist / Lab',
    grp3_classic: 'Modern Classic',
    grp3_avant_garde: 'Avant-garde',
    grp3_hotel_bar: 'Grand Hotel Bar',
    grp3_dive_bar: 'Elevated Dive Bar',

    // GROUP 4: BASE
    grp4_gin: 'Gin Based',
    grp4_agave: 'Agave (Tequila/Mezcal)',
    grp4_whiskey: 'Whiskey / Bourbon',
    grp4_rum: 'Rum / Cane',
    grp4_vodka: 'Vodka / Neutral',
    grp4_brandy: 'Brandy / Cognac',
    grp4_amaro: 'Amaro Based',
    grp4_wine: 'Wine / Champagne',
    grp4_zero_waste: 'Zero Waste',
    grp4_foraged: 'Foraged / Local',

    // Expertise
    exp_beginner: 'Home Bartender',
    exp_teacher: 'Bar Trainer',
    exp_enthusiast: 'Enthusiast',
    exp_pro: 'Bar Manager',

    // Loading States
    loading_materializing: 'Distilling your Vision...',
    loading_maestro_cooking: 'The Maestro is behind the stick...',
    error_title: 'A Broken Glass',
    error_desc: 'The Sages could not reach a consensus. Please refine your commission and try again.',
    btn_retry: 'Try Again',
    btn_new_commission: 'New Commission',

    // Recipe View
    meta_execution: 'PREP',
    section_rationale: 'Rationale',
    section_mise_en_place: 'Station Setup',
    section_preparation: 'Construction',
    section_toolkit: 'Strategic Toolkit',
    section_homemade: 'Homemade Prep',
    section_nutrition: 'Alcohol & Energy Profile',
    nutr_calories: 'Total Calories',
    nutr_abv: 'Alcohol By Volume (Diluted)',
    btn_gen_photo: 'Generate Photo',
    btn_download: 'Download Barman Copy',
    btn_export_code: 'Export Recipe Code',
    tip_label: 'Pro Tip',
    
    // PDF Columns
    col_ingredient: 'Ingredient',
    col_qty: 'Quantity',
    col_price: 'Market Price',
    col_cost: 'Cost',
    col_trend: 'Trend',
    col_abv: 'ABV %',
    col_calories: 'Calories (Kcal)',

    // Sages
    sages_intro: 'Here is the verdict of the Council of Sages for your drink:',
    sage_scientist: 'The Scientist',
    sage_artist: 'The Artist',
    sage_historian: 'The Historian',
    sage_philosopher: 'The Philosopher',

    // Market Analysis (Single Dish)
    ma_single_title: 'Granular Pour Cost Analysis',
    ma_single_calculating: 'Market analysis in progress on individual spirits...',
    market_title: 'Market Analysis',
    market_margin: 'Margin',
    market_export: 'Export Report',
    market_total_cost: 'Total Cost',
    market_sugg_price: 'Suggested Price',
    market_narrative: 'Commercial Strategy',

    // Photo Prompt
    photo_title: 'Maestro Visual Studio',
    photo_subtitle: 'Powered by Google Imagen',
    photo_label: 'Prompt Engineering (English)',
    photo_copy: 'Copia',
    photo_export_md: 'Export (MD)',
    photo_copied: 'Copiato!',
    photo_placeholder: 'Waiting for the Maestro\'s vision...',
    photo_render: 'Render Visualization',
    photo_developing: 'Developing Film...',
    photo_awaiting: 'Awaiting Render',
    photo_processing: 'Imagen Engine Processing...',
    
    // New Photo Buttons
    photo_btn_regenerate: 'Regenerate',
    photo_btn_download: 'Download Image',
    photo_btn_insert: 'Insert into Recipe',
    photo_btn_close: 'Back to Recipe',
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  readonly currentLang = signal<Language>('IT'); // Defaulting to IT as requested
  
  readonly t = computed(() => DICTIONARY[this.currentLang()]);

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
  }

  // Helper to get translated dynamic values
  getOptionLabel(key: string): string {
    const dict = this.t();
    // @ts-ignore
    const val = dict[key];
    // IMPORTANT: If key exists in dictionary, return translation.
    // If NOT (it's a dynamic AI string), return the key itself.
    return val || key;
  }
}