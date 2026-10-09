import { Component, ElementRef, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-form-feedback',
  imports: [MatButtonModule],
  template: `
    @if (message()) {
      <section class="form-feedback">
        <p role="alert">{{ message() }}</p>
        @if (target()) {
          <button mat-button type="button" (click)="locate()">前往需要修正的欄位</button>
        }
      </section>
    }
  `,
  styles: `
    .form-feedback { margin-block: 1rem; padding: .75rem;
      border-inline-start: 3px solid var(--color-negative); background: var(--color-negative-bg); }
    p { margin: 0; color: var(--color-negative); overflow-wrap: anywhere; }
  `,
})
export class FormFeedbackComponent {
  readonly message = input<string | null>(null);
  readonly target = input('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid');
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  locate(): void {
    if (!this.target()) return;
    const form = this.element.nativeElement.closest('form');
    const targets = form?.querySelectorAll<HTMLElement>(this.target()) ?? [];
    const field = [...targets].map(target => target.matches('input, textarea, button, mat-select') ? target
      : target.querySelector<HTMLElement>('input, textarea, mat-select')
        ?? target.querySelector<HTMLElement>('button'))
      .find(target => target && !target.hasAttribute('disabled'));
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: 'center' });
  }
}
