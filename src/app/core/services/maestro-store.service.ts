
import { Injectable, signal } from '@angular/core';
import { MaestroResponse, MenuProjectResponse } from '../models/maestro-schema.models';

export type AppState = 'LANDING' | 'CREATION';
export type CreationMode = 'SINGLE' | 'MENU' | 'ANALYSIS' | 'CALCULATOR';

@Injectable({
  providedIn: 'root'
})
export class MaestroStore {
  // Navigation State
  readonly appState = signal<AppState>('LANDING');
  readonly creationMode = signal<CreationMode>('SINGLE');

  // Data State (Persistent)
  readonly maestroResponse = signal<MaestroResponse | null>(null);
  readonly menuResponse = signal<MenuProjectResponse | null>(null);
  
  // UI States
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Actions
  setMode(mode: CreationMode) {
    this.creationMode.set(mode);
    this.appState.set('CREATION');
    this.error.set(null);
  }

  goHome() {
    this.appState.set('LANDING');
    // We do NOT clear data here, allowing persistence if user returns
  }

  startLoading() {
    this.isLoading.set(true);
    this.error.set(null);
  }

  stopLoading() {
    this.isLoading.set(false);
  }

  setError(msg: string) {
    this.error.set(msg);
    this.isLoading.set(false);
  }

  setSingleDish(data: MaestroResponse) {
    this.maestroResponse.set(data);
    this.isLoading.set(false);
  }

  setMenuProject(data: MenuProjectResponse) {
    this.menuResponse.set(data);
    this.isLoading.set(false);
  }

  resetData() {
    this.maestroResponse.set(null);
    this.menuResponse.set(null);
    this.error.set(null);
    this.isLoading.set(false);
  }
}
