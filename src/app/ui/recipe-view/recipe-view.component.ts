import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaestroSynthesis, MarketReport, PhotoPrompt, RecipeIngredient, RecipeStep } from '../../core/models/maestro-schema.models';
import { GeminiService } from '../../core/services/gemini.service';
import { LanguageService } from '../../core/services/language.service';
import { PdfService } from '../../core/services/pdf.service';
import { MarketAnalysisComponent } from '../market-analysis/market-analysis.component';
import { PhotoPromptComponent } from '../photo-prompt/photo-prompt.component';

@Component({
  selector: 'app-recipe-view',
  standalone: true,
  imports: [CommonModule, MarketAnalysisComponent, PhotoPromptComponent],
  templateUrl: './recipe-view.component.html',
})
export class RecipeViewComponent implements OnInit {
  @Input() data: MaestroSynthesis | null = null;
  @Input() meta: any = null;

  private readonly geminiService = inject(GeminiService);
  private readonly pdfService = inject(PdfService);
  readonly lang = inject(LanguageService);

  readonly isProcessing = signal<boolean>(false);
  readonly processingMessage = signal<string>('');

  // State for photo prompt
  readonly photoPrompt = signal<string | null>(null);
  readonly promptState = signal<'idle' | 'loading' | 'error' | 'success'>('idle');
  readonly showPhotoPromptModal = signal<boolean>(false);
  
  // State for the inserted image
  readonly insertedImage = signal<string | null>(null);
  
  ngOnInit() {
    // Initial configuration delegated to PdfService when needed.
  }

  get hasData(): boolean {
    return !!this.data && !!this.data.ingredients && this.data.ingredients.length > 0;
  }

  // --- 1. PHOTO PROMPT & GEN ---
  async triggerPhotoPromptGeneration(): Promise<void> {
    if (!this.data || !this.meta) return;

    this.promptState.set('loading');
    this.photoPrompt.set(null);
    this.showPhotoPromptModal.set(true);
    try {
      const result = await this.geminiService.generatePhotoPrompt(this.meta, this.data);
      this.photoPrompt.set(result.image_prompt);
      this.promptState.set('success');
    } catch (error) {
      console.error('Failed to generate photo prompt:', error);
      this.promptState.set('error');
    }
  }

  closeModal(): void {
    this.showPhotoPromptModal.set(false);
    this.photoPrompt.set(null);
    this.promptState.set('idle');
  }

  // Called when user clicks "Insert into Recipe" from the PhotoPrompt component
  onImageInserted(base64Image: string): void {
    this.insertedImage.set(base64Image);
    this.closeModal();
  }

  // --- 2. EXPORT CHEF COPY (PDF WITH GRANULAR MARKET ANALYSIS) ---
  async exportChefCopy() {
    if (!this.data || !this.meta || this.isProcessing()) return;

    this.isProcessing.set(true);
    this.processingMessage.set(this.lang.t().ma_single_calculating);

    try {
        // A. Run Granular Market Analysis
        const marketReport = await this.geminiService.analyzeSingleDishMarket(this.data);

        // B. Generate PDF
        this.processingMessage.set("Generating Document...");
        await this.generatePdf(marketReport);

    } catch (e) {
        console.error('Export failed', e);
        alert('Could not complete analysis or export.');
    } finally {
        this.isProcessing.set(false);
    }
  }

  private async generatePdf(report: MarketReport) {
      const ingredientsTable = this.data!.ingredients.map(ing => [
        { text: ing.name, style: 'ingName' }, 
        { text: ing.quantity, style: 'ingQty', alignment: 'right' }
      ]);

      // Steps formatted
      const stepsList = this.data!.steps.map(step => {
        const stack = [
            { text: `${step.step_number}. ${step.instruction}`, style: 'stepText', margin: [0, 0, 0, 8] }
        ];
        if (step.technical_note) {
            // @ts-ignore
            stack.push({ text: `Tip: ${step.technical_note}`, style: 'stepTip', margin: [15, 0, 0, 12] });
        } else {
             // @ts-ignore
             stack[0].margin = [0,0,0,12];
        }
        return stack;
      }).flat();

      // Financial Table - FIXED WIDTHS
      const financialBody = [
          [
            { text: this.lang.t().col_ingredient, style: 'th' }, 
            { text: this.lang.t().col_qty, style: 'th' }, 
            { text: this.lang.t().col_price, style: 'th' }, 
            { text: this.lang.t().col_cost, style: 'th', alignment: 'right' }
          ]
      ];
      report.cost_breakdown.forEach(item => {
          financialBody.push([
              { text: item.ingredient, style: 'cell' },
              { text: item.quantity_used, style: 'cellSmall' }, 
              { text: item.market_unit_price, style: 'cellSmall' },
              { text: `€${item.calculated_cost.toFixed(2)}`, style: 'cellBold', alignment: 'right' }
          ]);
      });

      // --- NUTRITIONAL & ABV TABLE (NEW) ---
      const nutritionBody = [
          [
            { text: this.lang.t().col_ingredient, style: 'th' },
            { text: this.lang.t().col_qty, style: 'th' },
            { text: this.lang.t().col_abv, style: 'th', alignment: 'center' },
            { text: this.lang.t().col_calories, style: 'th', alignment: 'right' }
          ]
      ];
      report.cost_breakdown.forEach(item => {
          nutritionBody.push([
              { text: item.ingredient, style: 'cell' },
              { text: item.quantity_used, style: 'cellSmall' },
              { text: item.abv_content || '-', style: 'cellSmall', alignment: 'center' },
              { text: item.calories ? item.calories.toString() : '-', style: 'cellBold', alignment: 'right' }
          ]);
      });

      const content = [];

      // --- PAGE 1: COVER ---
      content.push({ text: 'MAESTRO MIXOLOGIST', style: 'brand', margin: [0, 0, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 760, y2: 5, lineWidth: 1 }] });
      
      // Use Crimson for everything. Bold for Titles.
      content.push({ text: this.meta.dish_name, style: 'coverTitle', margin: [0, 60, 0, 10] });
      content.push({ text: `"${this.meta.concept_summary}"`, style: 'coverDesc', margin: [0, 0, 0, 40] });

      // Image if exists
      if (this.insertedImage()) {
         content.push({
            image: this.insertedImage(),
            width: 550, // High quality width
            alignment: 'center',
            margin: [0, 0, 0, 40]
         });
      }

      content.push({ text: '', pageBreak: 'after' });

      // --- PAGE 2: RECIPE ---
      content.push({ text: 'MAESTRO MIXOLOGIST', style: 'brand', margin: [0, 0, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 760, y2: 5, lineWidth: 1 }] });
      
      // Meta Header
      // We now have more meta: Calories and ABV from the initial estimate
      content.push({ text: `${this.meta.dish_name}`, style: 'h1', margin: [0, 30, 0, 10] });
      content.push({ text: `${this.meta.preparation_time_minutes} MIN  |  ${this.meta.difficulty_level.toUpperCase()}`, style: 'meta', margin: [0, 0, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 30] });

      // Recipe Columns
      content.push({
          columns: [
              // LEFT COL: MISE EN PLACE (35%)
              {
                  width: '35%',
                  stack: [
                      { text: this.lang.t().section_mise_en_place.toUpperCase(), style: 'h2' },
                      {
                          table: {
                              widths: ['*', 'auto'],
                              body: ingredientsTable
                          },
                          layout: 'noBorders'
                      },
                      { text: ' ', margin: [0, 30] },
                      
                      { text: 'SERVE', style: 'h2' },
                      { text: `Glass: ${this.data!.glassware_guide.glass_type}`, style: 'bodyItalic' },
                      { text: `Ice: ${this.data!.glassware_guide.ice_type}`, style: 'bodyItalic' },
                      { text: `Garnish: ${this.data!.glassware_guide.garnish_detail}`, style: 'bodyItalic', margin: [0, 5, 0, 0] }
                  ],
                  margin: [0, 0, 30, 0]
              },
              
              // RIGHT COL: EXECUTION (65%)
              {
                  width: '65%',
                  stack: [
                      { text: this.lang.t().section_preparation.toUpperCase(), style: 'h2' },
                      ...stepsList
                  ]
              }
          ]
      });

      // --- HOMEMADE PREPS IN PDF ---
      if (this.data!.homemade_preps && this.data!.homemade_preps.length > 0) {
         content.push({ text: ' ', margin: [0, 20] });
         content.push({ text: this.lang.t().section_homemade.toUpperCase(), style: 'h2' });
         content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 15] });

         this.data!.homemade_preps.forEach(prep => {
            const ingredientsString = prep.ingredients.join(', ');
            content.push(
               { text: `${prep.name.toUpperCase()} (${prep.yield || 'N/A'})`, style: 'h2', fontSize: 10 },
               { text: `Ingredients: ${ingredientsString}`, style: 'bodyItalic', margin: [0, 0, 0, 5] },
               { text: prep.instructions, style: 'body', margin: [0, 0, 0, 15] }
            );
         });
      }
      
      content.push({ text: '', pageBreak: 'after' });

      // --- PAGE 3: FINANCIAL & NUTRITIONAL ANALYSIS ---
      content.push({ text: 'MAESTRO MIXOLOGIST', style: 'brand', margin: [0, 0, 0, 20] });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 760, y2: 5, lineWidth: 1 }] });

      content.push({ text: this.lang.t().ma_single_title.toUpperCase(), style: 'h1', margin: [0, 30, 0, 20] });
      content.push({ text: `"${report.marketing_hook}"`, style: 'quote', margin: [0, 0, 0, 40] });
      
      // SECTION A: FINANCIALS
      content.push({ text: 'FINANCIAL PERFORMANCE', style: 'h2' });
      content.push({
          columns: [
              { stack: [{text:this.lang.t().ma_total_cost, style:'kpiLabel'}, {text:`€${report.total_pour_cost.toFixed(2)}`, style:'kpiValue'}] },
              { stack: [{text:this.lang.t().ma_rec_price, style:'kpiLabel'}, {text:`€${report.suggested_menu_price.toFixed(2)}`, style:'kpiValue'}] },
              { stack: [{text:this.lang.t().ma_margin, style:'kpiLabel'}, {text:`${report.profit_margin_percentage}%`, style:'kpiValue'}] },
          ]
      });
      content.push({ text: ' ', margin: [0, 15] });
      content.push({
          table: {
              headerRows: 1,
              widths: ['40%', '15%', '25%', '20%'], // Fixed widths
              body: financialBody
          },
          layout: 'lightHorizontalLines'
      });

      // SECTION B: NUTRITIONAL PROFILE (NEW)
      if (report.nutritional_profile) {
          content.push({ text: ' ', margin: [0, 25] });
          content.push({ text: this.lang.t().section_nutrition.toUpperCase(), style: 'h2' });
          
          content.push({
              columns: [
                  { stack: [{text:this.lang.t().nutr_abv, style:'kpiLabel'}, {text: report.nutritional_profile.final_abv, style:'kpiValue'}] },
                  { stack: [{text:this.lang.t().nutr_calories, style:'kpiLabel'}, {text:`${report.nutritional_profile.total_calories} kcal`, style:'kpiValue'}] },
                  { stack: [{text:'DILUTION FACTOR', style:'kpiLabel'}, {text: report.nutritional_profile.dilution_factor, style:'bodyItalic', margin: [0, 5, 0, 0]}] },
              ]
          });
          
          content.push({ text: ' ', margin: [0, 15] });
          content.push({
              table: {
                  headerRows: 1,
                  widths: ['40%', '20%', '20%', '20%'],
                  body: nutritionBody
              },
              layout: 'lightHorizontalLines'
          });
      }

      content.push({ text: ' ', margin: [0, 30] });
      content.push({ text: 'STRATEGY NOTE', style: 'h2' });
      content.push({ text: report.pricing_strategy_note, style: 'body', margin: [0, 0, 0, 30] });


      const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [50, 50, 50, 50],
        content: content,
        styles: {
            // BRAND: Crimson Bold
            brand: { fontSize: 8, letterSpacing: 3, color: '#888888', bold: true, font: 'Crimson' },
            
            // TITLES: Crimson Bold
            coverTitle: { fontSize: 56, color: '#1c1917', alignment: 'center', font: 'Crimson', bold: true, margin: [0, 0, 0, 0] },
            coverDesc: { fontSize: 22, italics: true, color: '#57534e', alignment: 'center', font: 'Crimson' },
            
            h1: { fontSize: 28, color: '#1c1917', font: 'Crimson', bold: true },
            h2: { fontSize: 11, bold: true, letterSpacing: 1, margin: [0, 0, 0, 10], color: '#1c1917', font: 'Crimson' },
            kpiValue: { fontSize: 24, bold: true, color: '#1c1917', font: 'Crimson' },
            
            // BODY: Crimson Text (Old Style Serif)
            title: { fontSize: 26, bold: true, color: '#1c1917', font: 'Crimson' },
            desc: { fontSize: 14, italics: true, color: '#57534e', font: 'Crimson' },
            meta: { fontSize: 10, bold: true, color: '#78716c', letterSpacing: 1, font: 'Crimson' },
            
            ingName: { fontSize: 11, color: '#44403c', font: 'Crimson' },
            ingQty: { fontSize: 11, bold: true, color: '#1c1917', font: 'Crimson' },
            
            stepText: { fontSize: 12, lineHeight: 1.4, color: '#1c1917', font: 'Crimson' },
            stepTip: { fontSize: 10, italics: true, color: '#78716c', font: 'Crimson' },
            
            body: { fontSize: 11, color: '#44403c', lineHeight: 1.4, font: 'Crimson' },
            bodyItalic: { fontSize: 11, italics: true, color: '#57534e', font: 'Crimson' },
            
            quote: { fontSize: 16, italics: true, border: [3, 0, 0, 0], borderColor: '#d6d3d1', margin: [5, 0, 0, 0], color: '#57534e', font: 'Crimson' },
            
            kpiLabel: { fontSize: 9, color: '#78716c', letterSpacing: 1, font: 'Crimson' },
            
            th: { fontSize: 10, bold: true, fillColor: '#f5f5f4', margin: [0, 6], font: 'Crimson' },
            cell: { fontSize: 11, margin: [0, 6], font: 'Crimson' },
            cellBold: { fontSize: 11, bold: true, margin: [0, 6], font: 'Crimson' },
            cellSmall: { fontSize: 10, color: '#78716c', margin: [0, 6], font: 'Crimson' }
        },
        defaultStyle: {
            font: 'Crimson'
        }
      };

      const safeFilename = this.meta.dish_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await this.pdfService.createPdf(docDefinition, `maestro_chef_copy_${safeFilename}.pdf`);
  }

  // --- 3. EXPORT RECIPE CODE (MARKDOWN) ---
  exportRecipeCode() {
    if (!this.data || !this.meta) return;

    let md = `---
id: ${Date.now()}
title: "${this.meta.dish_name}"
author: Maestro Mixologist
date: ${new Date().toISOString().split('T')[0]}
time_minutes: ${this.meta.preparation_time_minutes}
difficulty: ${this.meta.difficulty_level}
tags: [${this.meta.philosophical_pillar_alignment}]
abv: ${this.meta.abv_estimate}
calories: ${this.meta.calories_estimate}
---

# ${this.meta.dish_name}

> ${this.meta.concept_summary}

## Rationale
${this.data.rationale}

## Station Setup
${this.data.ingredients.map(i => `- ${i.name}: ${i.quantity} ${i.notes ? '('+i.notes+')' : ''}`).join('\n')}

## Construction
${this.data.steps.map(s => `${s.step_number}. ${s.instruction} ${s.technical_note ? '> Tip: '+s.technical_note : ''}`).join('\n')}

## Serve
- Glass: ${this.data.glassware_guide.glass_type}
- Ice: ${this.data.glassware_guide.ice_type}
- Garnish: ${this.data.glassware_guide.garnish_detail}

## Sensory Profile
- Taste: ${this.data.sensory_profile.taste_balance}
- Texture: ${this.data.sensory_profile.texture_map}
`;

    // Append Homemade Preps
    if (this.data.homemade_preps && this.data.homemade_preps.length > 0) {
        md += `\n## Homemade Preps & Batches\n`;
        this.data.homemade_preps.forEach(prep => {
            md += `### ${prep.name} (${prep.yield || ''})\n`;
            md += `*Ingredients: ${prep.ingredients.join(', ')}*\n\n`;
            md += `${prep.instructions}\n\n`;
        });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipe_code_${this.meta.dish_name.replace(/\s+/g, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}