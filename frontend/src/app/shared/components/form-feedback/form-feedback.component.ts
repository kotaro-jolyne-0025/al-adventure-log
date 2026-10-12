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
    .form-feedback { margin-block: .5rem; padding: .75rem;
      border-inline-start: 3px solid var(--mat-sys-error); background: var(--mat-sys-error-container); }
    p { margin: 0; font-size: var(--type-label); color: var(--mat-sys-on-error-container); overflow-wrap: anywhere; }
    button { height: auto; min-height: 44px; max-width: 100%; padding-block: .5rem; white-space: normal; }
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
