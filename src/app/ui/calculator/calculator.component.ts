import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlcoholCalculatorService, DilutionResult } from '../../core/services/alcohol-calculator.service';
import { PdfService } from '../../core/services/pdf.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calculator.component.html'
})
export class CalculatorComponent {
  private fb = inject(FormBuilder);
  private calculatorService = inject(AlcoholCalculatorService);
  private pdfService = inject(PdfService);
  readonly lang = inject(LanguageService);

  form: FormGroup;
  result = signal<DilutionResult | null>(null);
  aiAdvice = signal<string>('');
  isLoadingAi = signal(false);

  constructor() {
    this.form = this.fb.group({
      initialVolume: [1000, [Validators.required, Validators.min(1)]],
      initialAbv: [96, [Validators.required, Validators.min(0.1), Validators.max(100)]],
      targetAbv: [40, [Validators.required, Validators.min(0.1), Validators.max(100)]]
    });
  }

  async onCalculate() {
    if (this.form.invalid) return;

    const { initialVolume, initialAbv, targetAbv } = this.form.value;

    if (targetAbv >= initialAbv) {
      this.result.set(null);
      this.aiAdvice.set(this.lang.currentLang() === 'IT' 
        ? 'La gradazione target deve essere inferiore a quella iniziale.'
        : 'Target ABV must be lower than initial ABV.');
      return;
    }

    this.result.set(this.calculatorService.calculateDilution(initialVolume, initialAbv, targetAbv));

    this.isLoadingAi.set(true);
    this.aiAdvice.set('');
    try {
      const advice = await this.calculatorService.getSommelierAdvice(initialAbv, targetAbv);
      this.aiAdvice.set(advice);
    } finally {
      this.isLoadingAi.set(false);
    }
  }

  async downloadPdf() {
    const currentResult = this.result();
    if (!currentResult) return;
    
    await this.pdfService.generateDilutionReport({
      initialVol: this.form.value.initialVolume,
      initialAbv: this.form.value.initialAbv,
      targetAbv: this.form.value.targetAbv,
      result: currentResult,
      aiAdvice: this.aiAdvice(),
      isItalian: this.lang.currentLang() === 'IT'
    });
  }
}
