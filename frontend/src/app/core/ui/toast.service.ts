import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(kind: ToastKind, title: string, message?: string) {
    const toast: Toast = { id: this.nextId++, kind, title, message };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), 5000);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  info(title: string, message?: string) { this.show('info', title, message); }
  warning(title: string, message?: string) { this.show('warning', title, message); }
  error(title: string, message?: string) { this.show('error', title, message); }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
