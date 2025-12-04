import { ChangeDetectionStrategy, Component, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/services/language.service';
import { CreationMode } from '../../core/services/maestro-store.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  readonly lang = inject(LanguageService);
  
  modeSelected = output<CreationMode>();

  enterSingleMode(): void {
    this.modeSelected.emit('SINGLE');
  }

  enterMenuMode(): void {
    this.modeSelected.emit('MENU');
  }

  enterAnalysisMode(): void {
    this.modeSelected.emit('ANALYSIS');
  }

  enterCalculatorMode(): void {
    this.modeSelected.emit('CALCULATOR');
  }
}