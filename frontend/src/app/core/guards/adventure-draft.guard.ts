import { CanDeactivateFn } from '@angular/router';
import type { AdventureFormComponent } from '../../features/adventures/adventure-form/adventure-form.component';

export const adventureDraftGuard: CanDeactivateFn<AdventureFormComponent> = component => component.canLeave();
