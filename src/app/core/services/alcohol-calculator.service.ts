import { Injectable, inject } from '@angular/core';
import { GeminiService } from './gemini.service';
import { LanguageService } from './language.service';

export interface DilutionResult {
  waterToAdd: number;
  finalVolume: number;
}

@Injectable({
  providedIn: 'root'
})
export class AlcoholCalculatorService {
  private readonly gemini = inject(GeminiService);
  private readonly lang = inject(LanguageService);

  calculateDilution(initialVolume: number, initialAbv: number, targetAbv: number): DilutionResult {
    if (targetAbv >= initialAbv || targetAbv <= 0) {
      return { waterToAdd: 0, finalVolume: initialVolume };
    }

    const totalAlcohol = initialVolume * (initialAbv / 100);
    const finalVolume = totalAlcohol / (targetAbv / 100);
    const waterToAdd = finalVolume - initialVolume;

    return {
      waterToAdd: parseFloat(waterToAdd.toFixed(2)),
      finalVolume: parseFloat(finalVolume.toFixed(2))
    };
  }

  async getSommelierAdvice(initialAbv: number, targetAbv: number): Promise<string> {
    const isIT = this.lang.currentLang() === 'IT';
    
    const prompt = isIT
      ? `Agendo come esperto "Maestro Superiore Alcolico", fornisci un fatto o consiglio breve, spiritoso e interessante in 3 frasi sulla diluizione di uno spirito dal ${initialAbv}% ABV al ${targetAbv}% ABV. Menziona che tipo di distillati si trovano solitamente al ${targetAbv}%. Rispondi in italiano.`
      : `Acting as an expert "Maestro Superiore Alcolico" (Alcohol Master), provide a short, witty, and interesting 3-sentence fact or advice about diluting a spirit from ${initialAbv}% ABV down to ${targetAbv}% ABV. Mention what kind of spirits are usually found at ${targetAbv}%. Reply in English.`;

    try {
      const response = await this.gemini['getModel']('gemini-2.5-flash').generateContent(prompt);
      return response.response.text();
    } catch (error) {
      console.error('Error calling Gemini:', error);
      return isIT 
        ? 'Il Maestro Alcolico sta riposando (servizio AI non disponibile).'
        : 'The Alcohol Master is resting (AI service unavailable).';
    }
  }
}
