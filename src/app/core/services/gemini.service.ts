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

  // --- MARKET ANALYSIS: Single Dish Financial & Nutritional Report ---
  async analyzeSingleDishMarket(data: MaestroSynthesis): Promise<MarketReport> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';
    
    const ingredientsList = data.ingredients.map(i => `- ${i.name}: ${i.quantity}`).join('\n');
    const technique = data.steps.length > 0 ? data.steps[0].instruction : 'standard preparation';
    
    const systemPrompt = `
You are a Bar Business Consultant and Mixology Expert with deep knowledge of:
- Current European spirits and ingredients market prices (2024)
- Cocktail costing and pricing strategies
- Nutritional values and ABV calculations for beverages

LANGUAGE: Output all text in ${isIT ? 'ITALIAN' : 'ENGLISH'}.
`;

    const userPrompt = `
TASK: Analyze this cocktail recipe for financial viability and nutritional profile.

RECIPE INGREDIENTS:
${ingredientsList}

PREPARATION TECHNIQUE: ${technique}
ICE TYPE: ${data.glassware_guide.ice_type}

REQUIRED ANALYSIS:

1. **COST BREAKDOWN**: For each ingredient, provide:
   - Market unit price (e.g., "€28.00 / 700ml" for spirits, "€3.50 / 500ml" for juices)
   - Calculated cost for the quantity used in this recipe
   - Market trend: STABLE, RISING, or FALLING
   - ABV content (e.g., "40%" for spirits, "0%" for juices)
   - Calories for the quantity used

2. **FINANCIAL SUMMARY**:
   - Total pour cost (sum of all ingredient costs)
   - Suggested menu price (targeting 75-80% profit margin)
   - Actual profit margin percentage

3. **NUTRITIONAL PROFILE**:
   - Final ABV after dilution (consider ice type and technique: shaking adds ~25% water, stirring ~15%, neat/no ice = 0%)
   - Total calories
   - Dilution factor description

4. **MARKETING & STRATEGY**:
   - A compelling one-line marketing hook for this drink
   - A professional pricing strategy note (why this price makes sense)

OUTPUT FORMAT (JSON ONLY):
{
  "total_pour_cost": number,
  "suggested_menu_price": number,
  "profit_margin_percentage": number,
  "cost_breakdown": [
    {
      "ingredient": "string",
      "quantity_used": "string",
      "market_unit_price": "string",
      "calculated_cost": number,
      "market_trend": "STABLE" | "RISING" | "FALLING",
      "abv_content": "string",
      "calories": number
    }
  ],
  "nutritional_profile": {
    "final_abv": "string",
    "total_calories": number,
    "dilution_factor": "string"
  },
  "marketing_hook": "string",
  "pricing_strategy_note": "string"
}
`;

    try {
      const model = this.getModel(this.flashModelName, systemPrompt);
      const result = await model.generateContent(userPrompt);
      const report = this.extractJson<MarketReport>(result.response.text());
      
      // Validate and ensure all required fields exist
      return {
        total_pour_cost: report.total_pour_cost || 0,
        suggested_menu_price: report.suggested_menu_price || 0,
        profit_margin_percentage: report.profit_margin_percentage || 0,
        cost_breakdown: report.cost_breakdown || [],
        nutritional_profile: report.nutritional_profile || {
          final_abv: "N/A",
          total_calories: 0,
          dilution_factor: "N/A"
        },
        marketing_hook: report.marketing_hook || "A unique cocktail experience",
        pricing_strategy_note: report.pricing_strategy_note || "Priced for premium positioning"
      };
    } catch (error) {
      console.error('Market analysis failed:', error);
      // Return a fallback report instead of throwing
      return {
        total_pour_cost: 0,
        suggested_menu_price: 0,
        profit_margin_percentage: 0,
        cost_breakdown: data.ingredients.map(ing => ({
          ingredient: ing.name,
          quantity_used: ing.quantity,
          market_unit_price: "N/A",
          calculated_cost: 0,
          market_trend: 'STABLE' as const,
          abv_content: "0%",
          calories: 0
        })),
        nutritional_profile: {
          final_abv: "N/A",
          total_calories: 0,
          dilution_factor: "N/A"
        },
        marketing_hook: isIT ? "Analisi non disponibile" : "Analysis unavailable",
        pricing_strategy_note: isIT ? "Riprova più tardi" : "Please try again later"
      };
    }
  }

  // --- STUBS PER COMPILAZIONE (Implementazione successiva) ---
  // Metodi non ancora implementati

  // --- MENU GENERATION: Create Full Cocktail Menu ---
  async generateMenu(ingredients: string[], expertise: ExpertiseLevel, constraints: string[], numCourses: number = 4): Promise<MenuProjectResponse> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';

    const systemPrompt = `
You are a Bar Director and Menu Curator creating cohesive cocktail experiences.
You design menus that tell a story, with drinks that flow naturally from one to the next.

LANGUAGE: All text output must be in ${isIT ? 'ITALIAN' : 'ENGLISH'}.
`;

    const menuPrompt = `
TASK: Create a cohesive cocktail menu (drink flight) with ${numCourses} drinks.

AVAILABLE INGREDIENTS/THEMES: ${ingredients.join(', ')}
EXPERTISE LEVEL: ${expertise}
CONSTRAINTS/STYLE: ${constraints.join(', ')}

REQUIREMENTS:
1. Create a unifying CONCEPT that ties all drinks together
2. Design ${numCourses} distinct cocktails that form a narrative journey
3. Consider ABV progression (typically: lighter → stronger → digestif, or vice versa)
4. Each drink must be complete with ingredients, steps, and the Sages Council analysis

OUTPUT FORMAT (JSON ONLY):
{
  "concept": {
    "title": "string (creative menu title)",
    "description": "string (the narrative/theme)",
    "seasonality": "string (e.g., 'Autumn Transition', 'Year-Round')",
    "philosophical_theme": "string (e.g., 'Memory & Nostalgia', 'Urban Botanicals')"
  },
  "courses": [
    {
      "meta": {
        "dish_name": "string",
        "concept_summary": "string",
        "preparation_time_minutes": number,
        "difficulty_level": "string",
        "abv_estimate": "string",
        "calories_estimate": number,
        "drink_category": "string"
      },
      "sages_council": {
        "scientist": { "headline": "string", "analysis": "string" },
        "artist": { "headline": "string", "analysis": "string" },
        "historian": { "headline": "string", "analysis": "string" },
        "philosopher": { "headline": "string", "analysis": "string" }
      },
      "maestro_synthesis": {
        "rationale": "string",
        "ingredients": [{ "name": "string", "quantity": "string", "notes": "string" }],
        "steps": [{ "step_number": number, "instruction": "string", "technical_note": "string" }],
        "glassware_guide": { "glass_type": "string", "ice_type": "string", "garnish_detail": "string" },
        "sensory_profile": { "taste_balance": "string", "texture_map": "string" },
        "homemade_preps": []
      }
    }
  ]
}
`;

    try {
      const model = this.getModel(this.proModelName, systemPrompt);
      const result = await model.generateContent(menuPrompt);
      return this.extractJson<MenuProjectResponse>(result.response.text());
    } catch (error) {
      console.error('Menu generation failed:', error);
      throw new Error(isIT ? "Generazione menu fallita" : "Menu generation failed");
    }
  }

  // --- MENU MODIFICATION: Iteratively Modify Existing Menu ---
  async modifyMenu(menu: MenuProjectResponse, request: string): Promise<MenuProjectResponse> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';

    const systemPrompt = `
You are a Bar Director modifying an existing cocktail menu based on client feedback.
Maintain the overall concept coherence while implementing requested changes.

LANGUAGE: All text output must be in ${isIT ? 'ITALIAN' : 'ENGLISH'}.
`;

    const modifyPrompt = `
CURRENT MENU:
${JSON.stringify(menu, null, 2)}

CLIENT REQUEST:
"${request}"

TASK: Modify the menu according to the request while:
1. Maintaining overall concept coherence
2. Adjusting only what's necessary
3. Ensuring the narrative flow still works
4. Keeping the same JSON structure

OUTPUT: Return the COMPLETE modified menu in the same JSON format.
`;

    try {
      const model = this.getModel(this.proModelName, systemPrompt);
      const result = await model.generateContent(modifyPrompt);
      return this.extractJson<MenuProjectResponse>(result.response.text());
    } catch (error) {
      console.error('Menu modification failed:', error);
      throw new Error(isIT ? "Modifica menu fallita" : "Menu modification failed");
    }
  }

  // --- MENU MARKET ANALYSIS: Financial Overview for Entire Menu ---
  async analyzeMenuMarket(menu: MenuProjectResponse): Promise<MenuMarketReport> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';

    // Build a summary of all drinks and their ingredients
    const drinksSummary = menu.courses.map((course, idx) => {
      const ingredients = course.maestro_synthesis.ingredients
        .map(i => `${i.name}: ${i.quantity}`)
        .join(', ');
      return `Drink ${idx + 1}: ${course.meta.dish_name} - ${ingredients}`;
    }).join('\n');

    const systemPrompt = `
You are a Bar Business Analyst specializing in menu profitability and pricing strategy.

LANGUAGE: Output all text in ${isIT ? 'ITALIAN' : 'ENGLISH'}.
`;

    const analysisPrompt = `
TASK: Analyze the financial viability of this cocktail menu.

MENU CONCEPT: ${menu.concept.title}
DRINKS:
${drinksSummary}

REQUIRED ANALYSIS:
1. Calculate pour cost for each drink
2. Identify key expensive ingredients per drink
3. Calculate overall menu pour cost
4. Recommend price per person for the full experience
5. Target margin (aim for 75-80%)
6. Provide a financial narrative explaining the pricing strategy

OUTPUT FORMAT (JSON ONLY):
{
  "overall_pour_cost": number,
  "recommended_price_per_pax": number,
  "target_margin": number,
  "financial_narrative": "string",
  "dishes_breakdown": [
    {
      "dish_name": "string",
      "pour_cost": number,
      "key_expensive_ingredients": ["string"]
    }
  ]
}
`;

    try {
      const model = this.getModel(this.flashModelName, systemPrompt);
      const result = await model.generateContent(analysisPrompt);
      return this.extractJson<MenuMarketReport>(result.response.text());
    } catch (error) {
      console.error('Menu market analysis failed:', error);
      return {
        overall_pour_cost: 0,
        recommended_price_per_pax: 0,
        target_margin: 0,
        financial_narrative: isIT ? "Analisi non disponibile" : "Analysis unavailable",
        dishes_breakdown: menu.courses.map(c => ({
          dish_name: c.meta.dish_name,
          pour_cost: 0,
          key_expensive_ingredients: []
        }))
      };
    }
  }

  // --- BAR AUDIT: Analyze Existing Menu ---
  async analyzeExistingMenu(file: File | null, url: string | null): Promise<MenuAnalysisResponse> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';

    const systemPrompt = `
You are a Senior Bar Consultant specializing in menu optimization and brand strategy.
Your role is to audit cocktail menus and provide actionable insights.

LANGUAGE: Output all text in ${isIT ? 'ITALIAN' : 'ENGLISH'}.
`;

    const analysisInstructions = `
TASK: Analyze this cocktail menu and provide a comprehensive audit.

REQUIRED ANALYSIS:

1. **RESTAURANT PROFILE**: Infer from the menu:
   - name: The establishment name (if visible, otherwise "Unknown Venue")
   - brand_identity: The bar's positioning (e.g., "Speakeasy", "Craft Cocktail Bar", "Hotel Lounge", "Tiki Bar")
   - perceived_vibe: The atmosphere and experience it projects
   - target_audience: Who this menu is designed for

2. **DISH ANALYSIS**: For EACH drink on the menu, provide:
   - original_name: The drink's name as shown
   - current_description: The description/ingredients listed
   - critique: What's wrong or could be improved (be constructive but honest)
   - suggested_improvement: A specific, actionable improvement
   - alignment_score: 1-100 score of how well it fits the brand identity

3. **GLOBAL ASSESSMENT**:
   - global_critique: Overall assessment of the menu's strengths and weaknesses
   - strategic_opportunities: Array of 3-5 strategic recommendations for the entire menu

OUTPUT FORMAT (JSON ONLY):
{
  "restaurant_profile": {
    "name": "string",
    "brand_identity": "string",
    "perceived_vibe": "string",
    "target_audience": "string"
  },
  "dishes": [
    {
      "original_name": "string",
      "current_description": "string",
      "critique": "string",
      "suggested_improvement": "string",
      "alignment_score": number
    }
  ],
  "global_critique": "string",
  "strategic_opportunities": ["string"]
}
`;

    try {
      let result;

      if (file) {
        // Convert file to base64 for Gemini Vision
        const base64Data = await this.fileToBase64(file);
        const mimeType = file.type || 'image/jpeg';
        
        const model = this.genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          systemInstruction: systemPrompt
        });

        result = await model.generateContent([
          { text: analysisInstructions },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]);
      } else if (url) {
        // For URL, we ask the model to analyze based on description
        // Note: Gemini can't directly fetch URLs, so we provide context
        const model = this.getModel(this.flashModelName, systemPrompt);
        
        const urlPrompt = `
${analysisInstructions}

MENU SOURCE: Website URL - ${url}

Note: Please analyze based on typical cocktail menu patterns for this type of establishment.
If you cannot access the URL directly, provide a template analysis that the user can refine.
Ask the user to provide more details about the menu items if needed.

For now, create a sample analysis structure that demonstrates the audit format.
`;
        result = await model.generateContent(urlPrompt);
      } else {
        throw new Error("No file or URL provided");
      }

      const response = this.extractJson<MenuAnalysisResponse>(result.response.text());
      return response;

    } catch (error) {
      console.error('Menu analysis failed:', error);
      throw new Error(isIT ? "Analisi del menu fallita. Riprova." : "Menu analysis failed. Please try again.");
    }
  }

  // Helper: Convert File to Base64
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- BAR AUDIT: Regenerate a Single Dish with Improvement ---
  async regenerateDish(profile: RestaurantProfile, dish: AnalyzedDish): Promise<AnalyzedDish> {
    const lang = this.langService.currentLang();
    const isIT = lang === 'IT';

    const prompt = `
You are a Bar Consultant improving a cocktail for a specific venue.

VENUE PROFILE:
- Name: ${profile.name}
- Brand Identity: ${profile.brand_identity}
- Vibe: ${profile.perceived_vibe}
- Target Audience: ${profile.target_audience}

CURRENT DRINK TO IMPROVE:
- Name: ${dish.original_name}
- Description: ${dish.current_description}
- Previous Critique: ${dish.critique}

TASK: Create a NEW alternative proposal that:
1. Better aligns with the brand identity
2. Addresses the critique
3. Maintains or elevates the concept
4. Is practical to implement

LANGUAGE: ${isIT ? 'ITALIAN' : 'ENGLISH'}

OUTPUT FORMAT (JSON ONLY):
{
  "original_name": "string (new creative name)",
  "current_description": "string (new ingredients/description)",
  "critique": "string (why this version is better)",
  "suggested_improvement": "string (implementation notes)",
  "alignment_score": number (should be higher than before)
}
`;

    try {
      const model = this.getModel(this.flashModelName);
      const result = await model.generateContent(prompt);
      return this.extractJson<AnalyzedDish>(result.response.text());
    } catch (error) {
      console.error('Dish regeneration failed:', error);
      throw new Error(isIT ? "Rigenerazione fallita" : "Regeneration failed");
    }
  }

  // --- BAR AUDIT: Expand Analyzed Dish to Full Recipe ---
  async expandDishToRecipe(profile: RestaurantProfile, dish: AnalyzedDish, expertise: ExpertiseLevel): Promise<MaestroResponse> {
    const lang = this.langService.currentLang();
    const sysPrompt = this.getSystemPrompt(lang);

    const contextPrompt = `
CONTEXT: You are creating a full recipe for a bar with this profile:
- Name: ${profile.name}
- Brand Identity: ${profile.brand_identity}
- Vibe: ${profile.perceived_vibe}
- Target: ${profile.target_audience}

DRINK CONCEPT TO DEVELOP:
- Name: ${dish.original_name}
- Concept: ${dish.current_description}
- Strategic Direction: ${dish.suggested_improvement}

EXPERTISE LEVEL: ${expertise}

TASK: Create a complete cocktail recipe following the system JSON schema.
The recipe must align perfectly with the venue's brand identity.
JSON Only.
`;

    try {
      const model = this.getModel(this.proModelName, sysPrompt);
      const result = await model.generateContent(contextPrompt);
      return this.extractJson<MaestroResponse>(result.response.text());
    } catch (error) {
      console.error('Recipe expansion failed:', error);
      throw new Error("Failed to create full recipe");
    }
  }

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