import { Component, input, output, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../core/services/gemini.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-photo-prompt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './photo-prompt.component.html',
})
export class PhotoPromptComponent {
  // Use input() instead of @Input() for better signal integration
  initialPrompt = input<string>('');
  
  // Outputs for the parent component logic
  imageSelected = output<string>(); // Emits base64 when "Insert" is clicked
  closeRequested = output<void>(); // Emits when "Close" is clicked

  readonly lang = inject(LanguageService);
  private readonly geminiService = inject(GeminiService);

  // Convert state properties to signals for zoneless change detection
  editablePrompt = signal<string>('');
  generatedImageUrl = signal<string | null>(null);
  isGenerating = signal<boolean>(false);
  showImageOverlay = signal<boolean>(false);
  copySuccess = signal<boolean>(false);

  constructor() {
    // Sync input to local signal when it changes
    effect(() => {
      const prompt = this.initialPrompt();
      console.log('PhotoPromptComponent effect - initialPrompt:', prompt?.substring(0, 50) + '...');
      if (prompt && prompt.length > 0) {
        this.editablePrompt.set(prompt);
      }
    }, { allowSignalWrites: true });
  }

  copyPrompt() {
    navigator.clipboard.writeText(this.editablePrompt()).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    });
  }

  exportPromptMd() {
    const prompt = this.editablePrompt();
    if (!prompt) return;
    
    const content = `# Maestro Superiore Visual Prompt\n\n${prompt}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro_prompt_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async generateImage() {
    const prompt = this.editablePrompt();
    if (!prompt) return;
    
    this.showImageOverlay.set(true);
    this.isGenerating.set(true);
    // Don't clear previous image immediately if regenerating, 
    // but here we clear to show loading state cleanly
    this.generatedImageUrl.set(null); 

    try {
        const base64Bytes = await this.geminiService.generateImage(prompt);
        this.generatedImageUrl.set(`data:image/jpeg;base64,${base64Bytes}`);
    } catch (error) {
        console.error('Image generation failed', error);
        this.showImageOverlay.set(false);
        alert('Image generation failed. Please try again.');
    } finally {
        this.isGenerating.set(false);
    }
  }

  onImageLoad() {
    this.isGenerating.set(false);
  }

  // --- MENU ACTIONS ---

  handleRegenerate() {
    // Close overlay to let user edit the prompt again
    this.showImageOverlay.set(false);
    this.generatedImageUrl.set(null);
  }

  handleDownload() {
    const url = this.generatedImageUrl();
    if (!url) return;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-imagen-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  handleInsert() {
    const url = this.generatedImageUrl();
    if (url) {
      this.imageSelected.emit(url);
    }
  }

  handleClose() {
    // Just close the overlay internally or request parent to close
    this.showImageOverlay.set(false);
    this.closeRequested.emit();
  }
}