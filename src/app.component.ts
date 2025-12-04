import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './app/pages/dashboard/dashboard.component';
import { LandingComponent } from './app/pages/landing/landing.component';
import { CalculatorComponent } from './app/ui/calculator/calculator.component';
import { LanguageService, Language } from './app/core/services/language.service';
import { MaestroStore, CreationMode } from './app/core/services/maestro-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DashboardComponent, LandingComponent, CalculatorComponent]
})
export class AppComponent {
  private readonly store = inject(MaestroStore);
  readonly lang = inject(LanguageService);
  
  // High level state from Store
  readonly appState = this.store.appState;
  readonly creationMode = this.store.creationMode;

  selectMode(mode: CreationMode): void {
    this.store.setMode(mode);
  }

  backToHome(): void {
    this.store.goHome();
  }

  setLang(l: Language) {
    this.lang.setLanguage(l);
  }

  isLang(l: Language) {
    return this.lang.currentLang() === l;
  }
}