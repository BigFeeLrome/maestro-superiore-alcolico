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

  // Unifying on "Crimson Text" for the entire document to ensure stability and quality.
  // It is a high-quality Old Style Serif (OFL) suitable for fine dining menus.
  // We use GitHub Raw URLs pointing to specific static files.
  private readonly fonts = {
    CrimsonRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Regular.ttf',
    CrimsonBold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Bold.ttf',
    CrimsonItalic: 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/CrimsonText-Italic.ttf'
  };

  /**
   * Fetches fonts, converts to Base64, and configures PDFMake VFS.
   */
  async ensureFontsLoaded(): Promise<void> {
    if (this.fontsLoaded) return;

    // 1. Get the pdfMake instance
    const _pdfMake = (pdfMake as any).default || pdfMake;
    const _pdfFonts = (pdfFonts as any).default || pdfFonts;

    if (!_pdfMake) {
      console.error('PdfService: PDFMake not loaded');
      return;
    }

    // 2. Initialize VFS from pdfFonts (standard fonts) - CRITICAL for fallback
    if (!_pdfMake.vfs) {
        if (_pdfFonts && _pdfFonts.pdfMake && _pdfFonts.pdfMake.vfs) {
             _pdfMake.vfs = _pdfFonts.pdfMake.vfs;
        } else {
             _pdfMake.vfs = {};
        }
    }

    try {
      console.log('PdfService: Fetching professional fonts from remote...');
      // 3. Fetch all fonts in parallel
      const [cReg, cBold, cItalic] = await Promise.all([
        this.fetchFont(this.fonts.CrimsonRegular),
        this.fetchFont(this.fonts.CrimsonBold),
        this.fetchFont(this.fonts.CrimsonItalic)
      ]);

      // 4. Register files in Virtual File System
      _pdfMake.vfs['Crimson-Regular.ttf'] = cReg;
      _pdfMake.vfs['Crimson-Bold.ttf'] = cBold;
      _pdfMake.vfs['Crimson-Italic.ttf'] = cItalic;

      // 5. Configure Font Mapping
      // We map everything to Crimson Text. Titles will use bold.
      _pdfMake.fonts = {
        Crimson: {
          normal: 'Crimson-Regular.ttf',
          bold: 'Crimson-Bold.ttf',
          italics: 'Crimson-Italic.ttf',
          bolditalics: 'Crimson-Bold.ttf' // Fallback
        },
        // Fallback for standard refs
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
      
      // Fallback mapping so the PDF doesn't crash if network fails
      // We map our custom names back to standard Roboto which is built-in to pdfMake vfs
      _pdfMake.fonts = {
        Crimson: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        },
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        }
      };
      
      this.fontsLoaded = true;
    }
  }

  private async fetchFont(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch font: ${url} (Status: ${response.status})`);
    const buffer = await response.arrayBuffer();
    return this.arrayBufferToBase64(buffer);
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
    
    const _pdfMake = (pdfMake as any).default || pdfMake;
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

    const docDefinition = {
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
        font: 'Crimson'
      }
    };

    _pdfMake.createPdf(docDefinition).open();
  }
}