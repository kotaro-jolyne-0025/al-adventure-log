import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  LOCALE_ID,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeZhTW from '@angular/common/locales/zh-Hant';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import type { MatDateFormats } from '@angular/material/core';
import { TwDateAdapter } from './core/adapters/tw-date-adapter';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeZhTW);

/** NativeDateAdapter 使用 Intl.DateTimeFormatOptions，不是 Moment.js 格式字串 */
export const TW_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: null,  // NativeDateAdapter 自行解析
  },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { duration: 3000, horizontalPosition: 'right', verticalPosition: 'top' },
    },
    { provide: LOCALE_ID, useValue: 'zh-Hant' },
    { provide: DateAdapter, useClass: TwDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: TW_DATE_FORMATS },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
