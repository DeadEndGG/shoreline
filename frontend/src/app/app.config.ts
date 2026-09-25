import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Hash routing keeps deep links and refreshes working on any static host without rewrites.
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
