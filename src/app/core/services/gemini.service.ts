import { Injectable, inject } from '@angular/core';
import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { ExpertiseLevel, MaestroResponse, MaestroSynthesis, MarketReport, PhotoPrompt, MenuProjectResponse, MenuMarketReport, MenuAnalysisResponse, RestaurantProfile, AnalyzedDish } from '../models/maestro-schema.models';
import { LanguageService, Language } from './language.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private readonly genAI: GoogleGenerativeAI;
  private apiKey: string = '';
  
  private readonly proModelName = 'gemini-2.5-flash'; 
  private readonly flashModelName = 'gemini-2.5-flash'; 
  
  private readonly langService = inject(LanguageService);

  constructor() {
    this.apiKey = environment.geminiApiKey;
    const maskedKey = this.apiKey ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'MISSING';
    console.log('GeminiService init - API Key status:', maskedKey, 'Length:', this.apiKey?.length);

    if (!this.apiKey || this.apiKey === 'MISSING_API_KEY') {
      console.error("CRITICAL: API Key mancante o non valida. Configura environment.geminiApiKey su Railway.");
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  private getModel(modelName: string, sysInstruct?: string): GenerativeModel {
    console.log('Getting model:', modelName);
    return this.genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: sysInstruct
    });
  }

  // --- JSON PARSER ---
  private extractJson<T>(text: string): T {
    if (!text) throw new Error("Empty response from AI");
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch (e) {
      const firstCurly = clean.indexOf('{');
      const lastCurly = clean.lastIndexOf('}');
      if (firstCurly !== -1 && lastCurly !== -1) {
          try { return JSON.parse(clean.substring(firstCurly, lastCurly + 1)); } catch (e2) {}
      }
      const firstSquare = clean.indexOf('[');
      const lastSquare = clean.lastIndexOf(']');
      if (firstSquare !== -1 && lastSquare !== -1) {
          try { return JSON.parse(clean.substring(firstSquare, lastSquare + 1)); } catch (e3) {}
      }
      throw new Error("Failed to parse JSON response");
    }
  }

  // --- CORE METHODS ---

  async generateDish(ingredients: string[], expertise: ExpertiseLevel, constraints: string[]): Promise<MaestroResponse> {
    const sysPrompt = this.getSystemPrompt(this.langService.currentLang());
    const model = this.getModel(this.proModelName, sysPrompt);
    
    const prompt = `
      REQUEST:
      - Ingredients: ${ingredients.join(', ')}
      - Level: ${expertise}
      - Constraints: ${constraints.join(', ')}
      TASK: Create a cocktail recipe following the system JSON schema. JSON Only.
    `;

    try {
      const result = await model.generateContent(prompt);
      return this.extractJson<MaestroResponse>(result.response.text());
    } catch (error) {
      throw new Error("Errore durante la generazione del drink.");
    }
  }

  startMaestroChatSession(mode: 'SINGLE' | 'MENU'): ChatSession {
    const currentLang = this.langService.currentLang();
    const instruction = mode === 'MENU' 
       ? this.getMenuChatSystemPrompt(currentLang) 
       : this.getChatSystemPrompt(currentLang);

    const model = this.getModel(this.flashModelName, instruction);
    return model.startChat({});
  }

  private getChatSystemPrompt(lang: Language): string {
    const isIT = lang === 'IT';
    return `
ROLE: You are "Maestro Mixologist", a Culinary Architect of Liquids.
TONE: **Sophisticated, Professional, Insightful, yet Human.**
AVOID: Being robotic/cold. Also AVOID being overly poetic or dramatic.
STYLE: Speak like a World-Class Head Bartender briefing a colleague. Be concise but warm.
GOAL: Collaborate to conceive a unique cocktail concept.
LANGUAGE: **YOU MUST SPEAK ONLY IN ${isIT ? 'ITALIAN' : 'ENGLISH'}.**

PROTOCOL:
1. **Introduction**: Professional and welcoming.
2. **Discovery**: Ask questions to understand the soul of the drink (Spirit base, glassware preference, flavor profile).
3. **Refinement**: Suggest specific spirits or modern techniques (fat-washing, clarification).
4. **Trigger**: If the user says "Proceed" or "Go", reply EXACTLY: "READY_TO_MATERIALIZE".

*** CRITICAL OUTPUT FORMAT ***
You must structure every response in two parts separated by "|||".

**Part 1**: Your professional response/analysis (max 2-3 sentences). YOU ask the questions here.

**Part 2**: Three (3) short, clickable **OPTIONS/CHOICES** for the user to select.
   - **RULE**: These must be written in the **USER'S VOICE**.
   - **RULE**: They must be **ANSWERS** or **DIRECTIONS**, NOT questions.
   - **Bad Suggestion**: "Do you like Gin?" (This is a question)
   - **Good Suggestion**: "I prefer a Gin base" (This is a choice/answer)
   - **Good Suggestion**: "Surprise me with Agave" (This is a direction)

EXAMPLE OUTPUT:
An intriguing choice. The smokiness of the Mezcal requires a sharp acidity to balance it. How should we handle the citrus element?
|||
Use a clarified lime cordial | Introduce a shrub for complexity | Keep it fresh and bright

STRICT PROHIBITION:
- DO NOT generate the JSON recipe here.
`;
  }

  private getMenuChatSystemPrompt(lang: Language): string {
    const isIT = lang === 'IT';
    return `
ROLE: You are a Bar Director and Concept Curator.
TONE: Visionary, Holistic, Narrative-driven.
GOAL: Design a Cocktail Menu (Drink Flight).
FOCUS: Narrative arc, emotional journey, ABV progression, philosophy. Do NOT focus on single recipes yet.
LANGUAGE: **YOU MUST SPEAK ONLY IN ${isIT ? 'ITALIAN' : 'ENGLISH'}.**

PROTOCOL:
1. **Concept Definition**: Define the theme (e.g., "Prohibition Era", "Botanical Garden", "Future of Tiki").
2. **Flow**: Discuss how drinks transition (Aperitivo -> Main -> Digestivo).
3. **Refinement**: Suggest overarching philosophies (Zero Waste, Local Foraging).
4. **Trigger**: If the user says "Proceed" or "Go", reply EXACTLY: "READY_TO_MATERIALIZE".

*** CRITICAL OUTPUT FORMAT ***
Same as single dish: Use "|||" to separate text from 3 USER VOICE suggestions.

EXAMPLE SUGGESTIONS:
"Focus on a zero-waste narrative" | "Explore fermentation across all drinks" | "Contrast hot and cold serves"
`;
  }

  async generateCreativeFilters(category: string, language: Language, currentExcludes: string[]): Promise<string[]> {
    const prompt = `Generate 5 creative mixology tags for category "${category}". Language: ${language}. Exclude: ${currentExcludes.join(',')}. JSON Array only.`;
    try {
        const model = this.getModel(this.flashModelName);
        const result = await model.generateContent(prompt);
        return this.extractJson<string[]>(result.response.text());
    } catch(e) { return []; }
  }

  async generateRefinedQuestions(context: string, language: Language): Promise<string[]> {
    const prompt = `Based on chat: "${context}". Generate 3 short user options/answers. Language: ${language}. JSON Array String only.`;
    try {
        const model = this.getModel(this.flashModelName);
        const result = await model.generateContent(prompt);
        return this.extractJson<string[]>(result.response.text());
    } catch(e) { return []; }
  }

  async summarizeChatContext(chat: ChatSession): Promise<any> {
    const prompt = "Summarize finalized cocktail parameters from history. JSON: {ingredients:[], expertise:'', constraints:[], concept_abstract:''}";
    try {
        const result = await chat.sendMessage(prompt);
        return this.extractJson(result.response.text());
    } catch(e) { throw e; }
  }

  // --- IMAGEN (REST API WORKAROUND) ---
  // La libreria JS standard non supporta ancora `generateImages` direttamente, usiamo REST.
  async generateImage(prompt: string): Promise<string> {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1, aspectRatio: "1:1" }
            })
        });

        if (!response.ok) throw new Error(`Imagen API Error: ${response.statusText}`);
        
        const data = await response.json();
        // La struttura di risposta di Imagen REST
        const imageBytes = data.predictions?.[0]?.bytesBase64Encoded;
        
        if (!imageBytes) throw new Error("No image returned from Imagen");
        return imageBytes;

      } catch (e) {
          console.error("Image gen failed", e);
          throw new Error("Generazione immagine fallita.");
      }
  }

  async generatePhotoPrompt(meta: any, synthesis: any): Promise<PhotoPrompt> {
      const prompt = `Describe a professional photo of cocktail ${meta.dish_name}. Ingredients: ${synthesis.ingredients.map((i:any)=>i.name).join(',')}. Glass: ${synthesis.glassware_guide.glass_type}. JSON {image_prompt: string}`;
      try {
        const model = this.getModel(this.flashModelName);
        const res = await model.generateContent(prompt);
        return this.extractJson<PhotoPrompt>(res.response.text());
      } catch(e) { return { image_prompt: `Cocktail ${meta.dish_name} in a bar setting.` }; }
  }

  // --- STUBS PER COMPILAZIONE (Implementazione successiva) ---
  // Questi metodi sono placeholder per evitare errori di compilazione negli altri componenti
  async generateMenu(ing: string[], exp: any, constr: any, num?: number): Promise<MenuProjectResponse> { throw new Error("Menu generation coming soon"); }
  async modifyMenu(menu: any, req: string): Promise<MenuProjectResponse> { throw new Error("Menu modification coming soon"); }
  async analyzeMenuMarket(menu: MenuProjectResponse): Promise<MenuMarketReport> { return { overall_pour_cost: 0, recommended_price_per_pax: 0, target_margin: 0, financial_narrative: "Data unavailable", dishes_breakdown: [] }; }
  async analyzeSingleDishMarket(data: MaestroSynthesis): Promise<MarketReport> { return { total_pour_cost: 0, suggested_menu_price: 0, profit_margin_percentage: 0, cost_breakdown: [], marketing_hook: "N/A", pricing_strategy_note: "N/A", nutritional_profile: {final_abv:"0%", total_calories:0, dilution_factor:"0"}}; }
  async analyzeExistingMenu(file: any, url: any): Promise<MenuAnalysisResponse> { throw new Error("Not implemented"); }
  async regenerateDish(profile: any, dish: any): Promise<AnalyzedDish> { throw new Error("Not implemented"); }
  async expandDishToRecipe(profile: any, dish: any, exp: any): Promise<MaestroResponse> { throw new Error("Not implemented"); }

  // --- SYSTEM PROMPT ---
  private getSystemPrompt(lang: Language): string {
    const isIT = lang === 'IT';
    return `
### ROLE
You are "Maestro Mixologist", a World-Class Bar Director.
You define distinct cocktail recipes for **EXACTLY 1 SERVING**.

### LANGUAGE REQUIREMENT
**YOU MUST OUTPUT ALL TEXT CONTENT IN ${isIT ? 'ITALIAN (Italiano)' : 'ENGLISH'}.**

### OUTPUT SCHEMA (JSON ONLY)
{
  "meta": {
    "dish_name": "String",
    "concept_summary": "String",
    "preparation_time_minutes": Number,
    "difficulty_level": "String",
    "abv_estimate": "String",
    "calories_estimate": Number,
    "drink_category": "String"
  },
  "sages_council": {
    "scientist": { "headline": "String", "analysis": "String" },
    "artist": { "headline": "String", "analysis": "String" },
    "historian": { "headline": "String", "analysis": "String" },
    "philosopher": { "headline": "String", "analysis": "String" }
  },
  "maestro_synthesis": {
    "rationale": "String",
    "ingredients": [
      { "name": "String", "quantity": "String", "notes": "String" }
    ],
    "steps": [
      { "step_number": Number, "instruction": "String", "technical_note": "String" }
    ],
    "glassware_guide": {
      "glass_type": "String",
      "ice_type": "String",
      "garnish_detail": "String"
    },
    "sensory_profile": {
      "taste_balance": "String",
      "texture_map": "String"
    },
    "homemade_preps": [
      {
        "name": "String",
        "ingredients": ["String"],
        "instructions": "String",
        "yield": "String"
      }
    ]
  }
}`;
  }
}