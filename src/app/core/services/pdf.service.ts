import { Injectable } from '@angular/core';
// @ts-ignore
import * as pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private fontsLoaded = false;
  private pdfMakeInstance: any = null;

  private readonly fonts = {
    CrimsonRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Regular.ttf',
    CrimsonBold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Bold.ttf',
    CrimsonItalic: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Italic.ttf'
  };

  constructor() {
    this.initializePdfMake();
  }

  private initializePdfMake(): void {
    this.pdfMakeInstance = (pdfMake as any).default || pdfMake;
    const _pdfFonts = (pdfFonts as any).default || pdfFonts;

    if (_pdfFonts && _pdfFonts.pdfMake && _pdfFonts.pdfMake.vfs) {
      this.pdfMakeInstance.vfs = { ..._pdfFonts.pdfMake.vfs };
    } else {
      this.pdfMakeInstance.vfs = {};
    }

    this.pdfMakeInstance.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };
  }

  getPdfMake(): any {
    return this.pdfMakeInstance;
  }

  async ensureFontsLoaded(): Promise<void> {
    if (this.fontsLoaded) {
      if (this.pdfMakeInstance.vfs['Crimson-Bold.ttf']) {
        return;
      }
      this.fontsLoaded = false;
    }

    if (!this.pdfMakeInstance) {
      console.error('PdfService: PDFMake not loaded');
      this.initializePdfMake();
    }

    try {
      console.log('PdfService: Fetching professional fonts from remote...');
      
      const [cReg, cBold, cItalic] = await Promise.all([
        this.fetchFont(this.fonts.CrimsonRegular),
        this.fetchFont(this.fonts.CrimsonBold),
        this.fetchFont(this.fonts.CrimsonItalic)
      ]);

      if (!cReg || !cBold || !cItalic) {
        throw new Error('One or more fonts failed to load');
      }

      this.pdfMakeInstance.vfs['Crimson-Regular.ttf'] = cReg;
      this.pdfMakeInstance.vfs['Crimson-Bold.ttf'] = cBold;
      this.pdfMakeInstance.vfs['Crimson-Italic.ttf'] = cItalic;

      this.pdfMakeInstance.fonts = {
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
      console.log('Maestro Professional Fonts Loaded');

    } catch (error) {
      console.error('Failed to load custom fonts. Falling back to default system.', error);
      this.initializePdfMake();
      this.fontsLoaded = true;
    }
  }

  private async fetchFont(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${url} (Status: ${response.status})`);
      }
      const buffer = await response.arrayBuffer();
      return this.arrayBufferToBase64(buffer);
    } catch (error) {
      console.error(`Error fetching font from ${url}:`, error);
      throw error;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async generateDilutionReport(data: {
    initialVol: number;
    initialAbv: number;
    targetAbv: number;
    result: { waterToAdd: number; finalVolume: number };
    aiAdvice: string;
    isItalian: boolean;
  }): Promise<void> {
    await this.ensureFontsLoaded();

    const _pdfMake = this.getPdfMake();

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

    _pdfMake.createPdf(docDefinition).download('dilution-report.pdf');
  }
}
