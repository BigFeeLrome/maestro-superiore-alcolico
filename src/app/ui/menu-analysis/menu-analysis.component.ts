import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../core/services/gemini.service';
import { LanguageService } from '../../core/services/language.service';
import { PdfService } from '../../core/services/pdf.service';
import { MenuAnalysisResponse, AnalyzedDish, MaestroResponse, ExpertiseLevel } from '../../core/models/maestro-schema.models';
import { RecipeViewComponent } from '../recipe-view/recipe-view.component';

@Component({
  selector: 'app-menu-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipeViewComponent],
  templateUrl: './menu-analysis.component.html'
})
export class MenuAnalysisComponent {
  private readonly geminiService = inject(GeminiService);
  private readonly pdfService = inject(PdfService);
  readonly lang = inject(LanguageService);

  // Input State
  uploadedFile = signal<File | null>(null);
  websiteUrl = signal<string>('');
  
  // Logic State
  isAnalyzing = signal(false);
  analysisResult = signal<MenuAnalysisResponse | null>(null);
  
  // Track which rows are currently regenerating
  isRegeneratingRow = signal<Set<number>>(new Set());

  // Recipe Expansion State
  isGeneratingRecipe = signal(false);
  activeRecipe = signal<MaestroResponse | null>(null);

  // New: Configuration State for Recipe Creation
  recipeConfigDish = signal<AnalyzedDish | null>(null);
  selectedExpertise = signal<ExpertiseLevel>('Appassionato');

  // Export State
  isExporting = signal(false);

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadedFile.set(input.files[0]);
    }
  }

  async startAnalysis() {
    if (!this.uploadedFile() && !this.websiteUrl().trim()) return;

    this.isAnalyzing.set(true);
    this.analysisResult.set(null);

    try {
        const result = await this.geminiService.analyzeExistingMenu(
            this.uploadedFile(), 
            this.websiteUrl() || null
        );
        this.analysisResult.set(result);
    } catch (error) {
        console.error('Analysis failed', error);
        alert('Analysis failed. Please check your file or URL.');
    } finally {
        this.isAnalyzing.set(false);
    }
  }

  async regenerateDish(index: number, dish: AnalyzedDish) {
    const currentResult = this.analysisResult();
    if (!currentResult) return;

    // Set loading state for this row
    this.isRegeneratingRow.update(set => {
        const newSet = new Set(set);
        newSet.add(index);
        return newSet;
    });

    try {
        const newDish = await this.geminiService.regenerateDish(currentResult.restaurant_profile, dish);
        
        // Update the specific dish in the array
        const updatedDishes = [...currentResult.dishes];
        updatedDishes[index] = newDish;

        this.analysisResult.set({
            ...currentResult,
            dishes: updatedDishes
        });

    } catch (e) {
        console.error("Failed to regenerate dish", e);
        alert("Could not generate alternative proposal.");
    } finally {
        // Clear loading state
        this.isRegeneratingRow.update(set => {
            const newSet = new Set(set);
            newSet.delete(index);
            return newSet;
        });
    }
  }

  // STEP 1: OPEN CONFIGURATION OVERLAY
  openRecipeConfig(dish: AnalyzedDish) {
    this.selectedExpertise.set('Appassionato'); // Reset to default
    this.recipeConfigDish.set(dish);
  }

  // STEP 2: CLOSE CONFIGURATION OVERLAY
  closeRecipeConfig() {
    this.recipeConfigDish.set(null);
  }

  // STEP 3: CONFIRM AND GENERATE
  async confirmRecipeCreation() {
    const dish = this.recipeConfigDish();
    const expertise = this.selectedExpertise();
    const currentResult = this.analysisResult();

    if (!dish || !currentResult || this.isGeneratingRecipe()) return;

    this.closeRecipeConfig(); // Close the modal/overlay
    this.isGeneratingRecipe.set(true);
    
    try {
      const recipe = await this.geminiService.expandDishToRecipe(
          currentResult.restaurant_profile, 
          dish,
          expertise
      );
      this.activeRecipe.set(recipe);
    } catch(e) {
      console.error("Failed to create recipe", e);
      alert("Could not create the full recipe.");
    } finally {
      this.isGeneratingRecipe.set(false);
    }
  }

  closeRecipeModal() {
    this.activeRecipe.set(null);
  }

  // --- PDF EXPORT ---
  async exportAnalysisPdf() {
    const data = this.analysisResult();
    if (!data || this.isExporting()) return;

    this.isExporting.set(true);

    try {
        // Ensure fonts are loaded
        await this.pdfService.ensureFontsLoaded();
        
        // Use the service's pdfMake instance
        const _pdfMake = this.pdfService.getPdfMake();
        const docDefinition = this.buildAnalysisPdfDefinition(data);
        
        const filename = `Maestro_Audit_${data.restaurant_profile.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        _pdfMake.createPdf(docDefinition).download(filename);

    } catch (error) {
        console.error("PDF Export Failed", error);
        alert("Failed to generate PDF report.");
    } finally {
        this.isExporting.set(false);
    }
  }

  private buildAnalysisPdfDefinition(data: MenuAnalysisResponse): any {
    const content: any[] = [];

    // --- COVER PAGE ---
    content.push(
        { text: 'MAESTRO SUPERIORE', style: 'brandHeader', margin: [0, 0, 0, 40] },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }] }, // A4 Portrait width ~595pt (margins 40+40=80 => 515)
        
        { text: 'STRATEGIC CONSULTANCY REPORT', style: 'subHeader', margin: [0, 60, 0, 10] },
        { text: data.restaurant_profile.name, style: 'reportTitle', margin: [0, 0, 0, 40] },
        
        { text: `"${data.global_critique}"`, style: 'globalCritique', margin: [0, 0, 0, 40] }
    );

    // Identity Grid (Simulated with Columns)
    content.push({
        columns: [
            { stack: [{ text: 'IDENTITY', style: 'label' }, { text: data.restaurant_profile.brand_identity, style: 'value' }] },
            { stack: [{ text: 'PERCEPTION', style: 'label' }, { text: data.restaurant_profile.perceived_vibe, style: 'value' }] },
            { stack: [{ text: 'TARGET', style: 'label' }, { text: data.restaurant_profile.target_audience, style: 'value' }] },
        ],
        columnGap: 20,
        margin: [0, 0, 0, 40]
    });

    // Opportunities
    content.push({ text: 'STRATEGIC OPPORTUNITIES', style: 'sectionHeader' });
    const oppList = data.strategic_opportunities.map(op => ({
        text: `•  ${op}`, style: 'opportunityItem', margin: [10, 5, 0, 5]
    }));
    content.push({ stack: oppList, margin: [0, 0, 0, 20] });

    content.push({ text: '', pageBreak: 'after' });

    // --- DISH ANALYSIS TABLE ---
    content.push({ text: 'DETAILED MENU AUDIT', style: 'sectionHeader', margin: [0, 0, 0, 20] });

    const tableBody: any[] = [
        [
            { text: 'DISH / CONCEPT', style: 'th' },
            { text: 'CRITIQUE', style: 'th' },
            { text: 'IMPROVEMENT', style: 'th' },
            { text: 'SCORE', style: 'th', alignment: 'center' }
        ]
    ];

    data.dishes.forEach(dish => {
        let scoreColor = '#dc2626'; // Red
        if (dish.alignment_score >= 80) scoreColor = '#059669'; // Green
        else if (dish.alignment_score >= 50) scoreColor = '#d97706'; // Amber

        tableBody.push([
            {
                stack: [
                    { text: dish.original_name, style: 'cellTitle' },
                    { text: dish.current_description, style: 'cellDesc' }
                ],
                style: 'cell'
            },
            { text: dish.critique, style: 'cellText' },
            { text: dish.suggested_improvement, style: 'cellText' },
            { text: dish.alignment_score.toString(), style: 'cellScore', color: scoreColor, alignment: 'center' }
        ]);
    });

    content.push({
        table: {
            headerRows: 1,
            widths: ['25%', '30%', '35%', '10%'],
            body: tableBody,
            dontBreakRows: true
        },
        layout: 'lightHorizontalLines'
    });

    return {
        pageSize: 'A4',
        pageOrientation: 'portrait',
        pageMargins: [40, 40, 40, 40],
        content: content,
        defaultStyle: {
            font: 'Crimson'
        },
        styles: {
            brandHeader: { fontSize: 8, bold: true, color: '#888888', letterSpacing: 2, font: 'Crimson' },
            subHeader: { fontSize: 12, letterSpacing: 3, alignment: 'center', color: '#666666', font: 'Crimson' },
            reportTitle: { fontSize: 42, bold: true, alignment: 'center', color: '#1c1917', font: 'Crimson' },
            globalCritique: { fontSize: 18, italics: true, alignment: 'center', color: '#444444', font: 'Crimson', lineHeight: 1.4 },
            
            label: { fontSize: 8, bold: true, color: '#a8a29e', margin: [0, 0, 0, 2], font: 'Crimson', letterSpacing: 1 },
            value: { fontSize: 12, bold: true, color: '#1c1917', font: 'Crimson' },
            
            sectionHeader: { fontSize: 14, bold: true, color: '#1c1917', margin: [0, 10, 0, 10], decoration: 'underline', decorationColor: '#e5e7eb', font: 'Crimson' },
            opportunityItem: { fontSize: 12, color: '#44403c', font: 'Crimson' },

            th: { fontSize: 9, bold: true, fillColor: '#f5f5f4', margin: [0, 8], font: 'Crimson', color: '#57534e' },
            cell: { margin: [0, 8], font: 'Crimson' },
            cellTitle: { fontSize: 11, bold: true, color: '#1c1917', font: 'Crimson' },
            cellDesc: { fontSize: 10, italics: true, color: '#78716c', font: 'Crimson', margin: [0, 2, 0, 0] },
            cellText: { fontSize: 10, color: '#44403c', margin: [0, 8], font: 'Crimson' },
            cellScore: { fontSize: 12, bold: true, margin: [0, 8], font: 'Crimson' }
        },
        footer: (currentPage: any, pageCount: any) => {
            return { 
                text: `${currentPage} / ${pageCount}`, 
                alignment: 'right', 
                fontSize: 8, 
                color: '#aaaaaa', 
                margin: [0, 10, 40, 0] 
            };
        }
    };
  }
}