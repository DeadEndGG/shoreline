import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { inBrowserApiInterceptor } from './demo-api/in-browser-api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Browser mode (default): the demo API runs in-page, so the app is a fully static site.
    provideHttpClient(withFetch(), withInterceptors(environment.api === 'browser' ? [inBrowserApiInterceptor] : [])),
    // Hash routing keeps deep links and refreshes working on any static host without rewrites.
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
