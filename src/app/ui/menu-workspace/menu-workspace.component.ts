import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuProjectResponse, MenuMarketReport } from '../../core/models/maestro-schema.models';
import { LanguageService } from '../../core/services/language.service';
import { GeminiService } from '../../core/services/gemini.service';
import { PdfService } from '../../core/services/pdf.service';
import { MaestroStore } from '../../core/services/maestro-store.service';
import { RecipeViewComponent } from '../recipe-view/recipe-view.component';
import { SageCardComponent } from '../sage-card/sage-card.component';

@Component({
  selector: 'app-menu-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipeViewComponent, SageCardComponent],
  templateUrl: './menu-workspace.component.html'
})
export class MenuWorkspaceComponent implements OnInit {
  @Input({ required: true }) project!: MenuProjectResponse;
  
  private readonly geminiService = inject(GeminiService);
  private readonly pdfService = inject(PdfService);
  private readonly store = inject(MaestroStore);
  readonly lang = inject(LanguageService);

  // UI State
  selectedCourseIndex = signal<number | null>(null); // Null means "Overview Mode"
  isProcessing = signal<boolean>(false);
  processingMessage = signal<string>('');
  
  // Analysis State
  marketReport = signal<MenuMarketReport | null>(null);
  isAnalyzing = signal<boolean>(false);
  showAnalysisModal = signal<boolean>(false);

  // History State (For Undo)
  private historyStack: MenuProjectResponse[] = [];

  // Chat Logic
  chatInput = '';
  chatMessages = signal<{role: 'user' | 'model', text: string}[]>([]);

  ngOnInit() {
    // Initialization delegated to PdfService.
  }

  selectCourse(index: number) {
    this.selectedCourseIndex.set(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToOverview() {
    this.selectedCourseIndex.set(null);
  }

  // --- HISTORY MANAGEMENT ---
  private pushToHistory() {
    // CRITICAL GUARD: Prevent crash if project is undefined
    if (!this.project) return;

    try {
        // Deep copy current state before modifying
        this.historyStack.push(JSON.parse(JSON.stringify(this.project)));
        
        // MEMORY LEAK FIX: Limit stack size
        if (this.historyStack.length > 10) {
            this.historyStack.shift(); // Remove oldest
        }
    } catch (e) {
        console.warn("Failed to push history state", e);
    }
  }

  undo() {
    if (this.historyStack.length === 0) return;
    const previousState = this.historyStack.pop();
    if (previousState) {
      this.project = previousState;
      // Sync back to store to ensure persistence
      this.store.setMenuProject(this.project);
      
      this.chatMessages.update(msgs => [...msgs, { 
        role: 'model', 
        text: `(System) ${this.lang.t().btn_undo_last}` 
      }]);
    }
  }

  canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  // --- ACTIONS ---

  async sendChatMessage() {
    if (!this.chatInput.trim() || this.isProcessing()) return;
    
    const userText = this.chatInput;
    this.chatInput = '';
    
    // Add user message
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: userText }]);
    
    // Start Processing
    this.isProcessing.set(true);
    this.processingMessage.set(this.lang.t().msg_updating_menu);

    try {
      // Save current state
      this.pushToHistory();

      // Call API
      const updatedMenu = await this.geminiService.modifyMenu(this.project, userText);
      
      // Update State
      this.project = updatedMenu;
      this.store.setMenuProject(updatedMenu); // Persist
      
      this.chatMessages.update(msgs => [...msgs, { 
          role: 'model', 
          text: 'Vision updated.' 
      }]);

    } catch (error: any) {
      console.error('Chat modification failed', error);
      // Use specific error
      this.chatMessages.update(msgs => [...msgs, { 
          role: 'model', 
          text: error.message || this.lang.t().error_desc
      }]);
      // Revert history on error
      this.undo(); 
    } finally {
      this.isProcessing.set(false);
    }
  }

  async regenerateCourse(index: number, event: Event) {
    event.stopPropagation(); // Prevent opening the course details
    if (this.isProcessing()) return;

    this.isProcessing.set(true);
    this.processingMessage.set(this.lang.t().msg_regenerating_dish);

    const dishName = this.project.courses[index].meta.dish_name;
    const request = `Regenerate the drink number ${index + 1} ("${dishName}"). Create a totally new cocktail that fits the theme perfectly.`;

    try {
      this.pushToHistory();
      const updatedMenu = await this.geminiService.modifyMenu(this.project, request);
      this.project = updatedMenu;
      this.store.setMenuProject(updatedMenu); // Persist
    } catch (error) {
      console.error('Regeneration failed', error);
      this.undo();
    } finally {
      this.isProcessing.set(false);
    }
  }

  // --- PHASE 3: ANALYSIS & EXPORT ---

  async runEconomicAnalysis() {
    this.isAnalyzing.set(true);
    this.showAnalysisModal.set(true);
    
    try {
        const report = await this.geminiService.analyzeMenuMarket(this.project);
        this.marketReport.set(report);
    } catch (e) {
        console.error('Analysis failed', e);
    } finally {
        this.isAnalyzing.set(false);
    }
  }

  closeAnalysisModal() {
    this.showAnalysisModal.set(false);
  }

  async triggerPdfExport() {
    if (this.isProcessing()) return;

    // STEP 1: Auto-Run Analysis if missing
    if (!this.marketReport()) {
        this.isProcessing.set(true);
        this.processingMessage.set(this.lang.t().msg_analyzing_costs || "Performing Financial Analysis...");
        try {
            const report = await this.geminiService.analyzeMenuMarket(this.project);
            this.marketReport.set(report);
        } catch (e: any) {
             console.error('Auto-analysis failed', e);
             this.isProcessing.set(false);
             // Specific alert
             alert(`Could not complete financial analysis: ${e.message}. PDF Export aborted.`);
             return;
        }
    }

    // STEP 2: Load Fonts
    this.isProcessing.set(true);
    this.processingMessage.set("Loading Typography...");
    try {
        await this.pdfService.ensureFontsLoaded();
    } catch(e) {
        console.warn('Font loading failed, falling back', e);
    }

    // STEP 3: Generate PDF using PDFMake
    this.processingMessage.set("Generating Document Structure...");

    try {
        // Use the service's pdfMake instance instead of importing directly
        const _pdfMake = this.pdfService.getPdfMake();
        
        // Safety check for library loading
        if (!_pdfMake || !_pdfMake.createPdf) {
            throw new Error("PDFMake library not loaded correctly");
        }

        const docDefinition = this.buildPdfDefinition();
        const safeFilename = this.project.concept.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        _pdfMake.createPdf(docDefinition).download(`maestro_concept_${safeFilename}.pdf`);

    } catch (error) {
        console.error('PDF Make Failed', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        this.isProcessing.set(false);
    }
  }

  // --- PDF DEFINITION BUILDER ---
  private buildPdfDefinition(): any {
    const report = this.marketReport();
    
    const content: any[] = [];

    // 1. COVER PAGE
    content.push(
      { text: 'MAESTRO MIXOLOGIST', style: 'brandHeader', margin: [0, 0, 0, 40] },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 760, y2: 5, lineWidth: 1 }] }, 
      { text: this.project.concept.title, style: 'coverTitle', margin: [0, 60, 0, 20] },
      { text: `"${this.project.concept.description}"`, style: 'coverDesc', margin: [0, 0, 0, 40] },
      { text: `${this.project.concept.seasonality}  |  ${this.project.concept.philosophical_theme}`, style: 'coverMeta' },
      { text: '', pageBreak: 'after' } 
    );

    // 2. COURSES
    this.project.courses.forEach((course, index) => {
        // Header
        content.push(
           {
              columns: [
                 { width: '*', text: `Drink ${index + 1}`, style: 'courseLabel' },
                 { width: 'auto', text: [`${course.meta.preparation_time_minutes} MIN`, `  |  `, `${course.meta.difficulty_level}`], style: 'courseMeta' }
              ],
              margin: [0, 0, 0, 5]
           },
           { text: course.meta.dish_name, style: 'dishTitle', margin: [0, 0, 0, 20] },
           { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 20] }
        );

        // Body: 2 Columns (Ingredients | Execution)
        const ingredientsList = course.maestro_synthesis.ingredients.map(ing => {
            return {
                columns: [
                    { text: ing.name, style: 'ingName', width: '*' },
                    { text: ing.quantity, style: 'ingQty', width: 'auto' }
                ],
                margin: [0, 0, 0, 3]
            };
        });

        const stepsList = course.maestro_synthesis.steps.map(step => {
            const stack = [
                { text: `${step.step_number}. ${step.instruction}`, style: 'stepText', margin: [0, 0, 0, 2] }
            ];
            if (step.technical_note) {
                // @ts-ignore
                stack.push({ text: `Tip: ${step.technical_note}`, style: 'stepTip', margin: [15, 0, 0, 8] });
            } else {
                // @ts-ignore
                stack[0].margin = [0,0,0,8];
            }
            return stack;
        }).flat();

        content.push({
            columns: [
                // LEFT: Ingredients & Plating
                {
                    width: '35%',
                    stack: [
                        { text: 'STATION SETUP', style: 'sectionHeader' },
                        ...ingredientsList,
                        { text: ' ', margin: [0, 20, 0, 0] },
                        { text: 'SERVE', style: 'sectionHeader' },
                        { text: `Glass: ${course.maestro_synthesis.glassware_guide.glass_type}`, style: 'platingText' },
                        { text: `Ice: ${course.maestro_synthesis.glassware_guide.ice_type}`, style: 'platingText' },
                        { text: `Garnish: ${course.maestro_synthesis.glassware_guide.garnish_detail}`, style: 'platingText', margin: [0, 5, 0, 0] }
                    ],
                    margin: [0, 0, 20, 0]
                },
                // RIGHT: Execution 
                {
                    width: '65%',
                    stack: [
                        { text: 'CONSTRUCTION', style: 'sectionHeader' },
                        ...stepsList
                    ]
                }
            ]
        });

        // Add page break after each course 
        content.push({ text: '', pageBreak: 'after' });
    });

    // 3. FINANCIALS
    if (report) {
        const tableBody = [
            [{ text: 'Drink', style: 'tableHeader' }, { text: 'Cost', style: 'tableHeader', alignment: 'right' }]
        ];
        
        report.dishes_breakdown.forEach(dish => {
            tableBody.push([
                { text: dish.dish_name, style: 'tableCell' }, 
                { text: `€${dish.pour_cost.toFixed(2)}`, style: 'tableCellMono', alignment: 'right' }
            ]);
        });

        content.push(
            { text: 'FINANCIAL ANALYSIS', style: 'brandHeader', margin: [0, 0, 0, 20] },
            { text: `"${report.financial_narrative}"`, style: 'quote', margin: [0, 0, 0, 30] },
            
            // KPI Cards simulated with columns
            {
                columns: [
                    { stack: [{text:'TOTAL POUR COST', style:'kpiLabel'}, {text:`€${report.overall_pour_cost.toFixed(2)}`, style:'kpiValue'}] },
                    { stack: [{text:'REC. PRICE', style:'kpiLabel'}, {text:`€${report.recommended_price_per_pax.toFixed(2)}`, style:'kpiValue'}] },
                    { stack: [{text:'MARGIN', style:'kpiLabel'}, {text:`${report.target_margin}%`, style:'kpiValue'}] },
                ]
            },
            { text: ' ', margin: [0, 20] },
            
            // Table
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto'],
                    body: tableBody
                },
                layout: 'lightHorizontalLines'
            }
        );
    }

    return {
        // Landscape A4
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [50, 50, 50, 50],
        content: content,
        defaultStyle: {
            font: 'Crimson' 
        },
        styles: {
            brandHeader: { fontSize: 8, bold: true, color: '#888888', letterSpacing: 2, font: 'Crimson' },
            coverTitle: { fontSize: 56, alignment: 'center', font: 'Crimson', color: '#1c1917', bold: true },
            coverDesc: { fontSize: 24, italics: true, alignment: 'center', color: '#444444', font: 'Crimson' },
            coverMeta: { fontSize: 10, alignment: 'center', color: '#666666', characterSpacing: 1, font: 'Crimson' },
            
            courseLabel: { fontSize: 10, color: '#888888', bold: true, characterSpacing: 1, font: 'Crimson' },
            courseMeta: { fontSize: 10, color: '#444444', alignment: 'right', font: 'Crimson' },
            dishTitle: { fontSize: 28, color: '#222222', font: 'Crimson', bold: true },
            
            sectionHeader: { fontSize: 10, bold: true, color: '#000000', margin: [0, 0, 0, 10], fillColor: '#eeeeee', font: 'Crimson' },
            
            ingName: { fontSize: 11, color: '#333333', font: 'Crimson' },
            ingQty: { fontSize: 11, bold: true, color: '#000000', alignment: 'right', font: 'Crimson' },
            
            stepText: { fontSize: 12, color: '#222222', lineHeight: 1.3, font: 'Crimson' },
            stepTip: { fontSize: 10, italics: true, color: '#666666', font: 'Crimson' },
            
            platingText: { fontSize: 11, italics: true, color: '#444444', font: 'Crimson' },

            quote: { fontSize: 16, italics: true, border: [4, 0, 0, 0], borderColor: '#cccccc', margin: [10, 0, 0, 0], font: 'Crimson' },
            kpiLabel: { fontSize: 9, color: '#888888', font: 'Crimson' },
            kpiValue: { fontSize: 24, bold: true, color: '#222222', font: 'Crimson' },
            tableHeader: { fontSize: 10, bold: true, fillColor: '#f8f8f8', font: 'Crimson' },
            tableCell: { fontSize: 11, margin: [0, 5], font: 'Crimson' },
            tableCellMono: { fontSize: 11, bold: true, margin: [0, 5], font: 'Crimson' }
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