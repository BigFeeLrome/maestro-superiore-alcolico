import { Injectable } from '@angular/core';

// @ts-ignore - Import pdfMake SOLO qui, una volta sola
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts';

export type TDocumentDefinitions = Parameters<typeof pdfMake.createPdf>[0];

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private fontsLoaded = false;
  private fontsLoading: Promise<void> | null = null;

  private readonly FONT_URLS = {
    regular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Bold.ttf',
    italic: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Italic.ttf'
  };

  constructor() {
    this.initializeDefaultFonts();
  }

  private initializeDefaultFonts(): void {
    (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
    
    (pdfMake as any).fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      },
      Crimson: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };
  }

  async ensureFontsLoaded(): Promise<void> {
    if (this.fontsLoaded) return;
    
    if (this.fontsLoading) {
      await this.fontsLoading;
      return;
    }

    this.fontsLoading = this.loadFonts();
    await this.fontsLoading;
  }

  private async loadFonts(): Promise<void> {
    try {
      console.log('PdfService: Fetching professional fonts...');

      const [regular, bold, italic] = await Promise.all([
        this.fetchFontAsBase64(this.FONT_URLS.regular),
        this.fetchFontAsBase64(this.FONT_URLS.bold),
        this.fetchFontAsBase64(this.FONT_URLS.italic)
      ]);

      (pdfMake as any).vfs['Crimson-Regular.ttf'] = regular;
      (pdfMake as any).vfs['Crimson-Bold.ttf'] = bold;
      (pdfMake as any).vfs['Crimson-Italic.ttf'] = italic;

      (pdfMake as any).fonts = {
        ...(pdfMake as any).fonts,
        Crimson: {
          normal: 'Crimson-Regular.ttf',
          bold: 'Crimson-Bold.ttf',
          italics: 'Crimson-Italic.ttf',
          bolditalics: 'Crimson-Bold.ttf'
        },
        Roboto: {
          normal: 'Crimson-Regular.ttf',
          bold: 'Crimson-Bold.ttf',
          italics: 'Crimson-Italic.ttf',
          bolditalics: 'Crimson-Bold.ttf'
        }
      };

      this.fontsLoaded = true;
      console.log('PdfService: Professional fonts loaded successfully');

    } catch (error) {
      console.warn('PdfService: Failed to load custom fonts, using defaults', error);
      this.fontsLoaded = true;
    } finally {
      this.fontsLoading = null;
    }
  }

  private async fetchFontAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Font fetch failed: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async createPdf(docDefinition: TDocumentDefinitions, filename: string): Promise<void> {
    await this.ensureFontsLoaded();
    
    return new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).download(filename, () => {
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async openPdf(docDefinition: TDocumentDefinitions): Promise<void> {
    await this.ensureFontsLoaded();
    
    return new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).open({}, window);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async getPdfBlob(docDefinition: TDocumentDefinitions): Promise<Blob> {
    await this.ensureFontsLoaded();
    
    return new Promise((resolve) => {
      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
        resolve(blob);
      });
    });
  }

  async generateDilutionReport(data: {
    initialVol: number;
    initialAbv: number;
    targetAbv: number;
    result: { waterToAdd: number; finalVolume: number };
    aiAdvice: string;
    isItalian: boolean;
  }): Promise<void> {
    const t = data.isItalian
      ? {
          title: 'Maestro Superiore Alcolico',
          subtitle: 'Report di Diluizione',
          initialVol: 'Volume Iniziale',
          initialAbv: 'Gradazione Iniziale',
          targetAbv: 'Gradazione Target',
          waterToAdd: 'Acqua da Aggiungere',
          finalVol: 'Volume Finale',
          adviceTitle: 'Consiglio del Maestro:',
          generated: 'Generato il'
        }
      : {
          title: 'Maestro Superiore Alcolico',
          subtitle: 'Dilution Report',
          initialVol: 'Initial Volume',
          initialAbv: 'Initial ABV',
          targetAbv: 'Target ABV',
          waterToAdd: 'Water to Add',
          finalVol: 'Final Volume',
          adviceTitle: 'Maestro\'s Advice:',
          generated: 'Generated on'
        };

    const docDefinition: any = {
      content: [
        { text: t.title, style: 'header' },
        { text: t.subtitle, style: 'subheader' },
        { text: ' ', margin: [0, 10] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [t.initialVol, `${data.initialVol} ml`],
              [t.initialAbv, `${data.initialAbv}%`],
              [t.targetAbv, `${data.targetAbv}%`],
              [{ text: t.waterToAdd, bold: true }, { text: `${data.result.waterToAdd} ml`, bold: true }],
              [t.finalVol, `${data.result.finalVolume} ml`]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6
          }
        },
        { text: t.adviceTitle, style: 'subheader', margin: [0, 15, 0, 5] },
        { text: data.aiAdvice, italics: true, color: '#555555' },
        {
          text: `${t.generated} ${new Date().toLocaleDateString()}`,
          alignment: 'right',
          margin: [0, 20],
          fontSize: 10,
          color: '#888888'
        }
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10],
          color: '#4F46E5'
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 10, 0, 5]
        }
      },
      defaultStyle: {
        font: 'Roboto'
      }
    };

    await this.createPdf(docDefinition, 'dilution-report.pdf');
  }
}
