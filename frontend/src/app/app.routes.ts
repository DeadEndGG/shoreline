import { Routes } from '@angular/router';
import { requireDemoSession } from './core/auth/demo-session';
import { AdminShell } from './layout/admin-shell/admin-shell';

export const routes: Routes = [
  {
    // The guest pass is a standalone experience without the admin chrome.
    path: 'guest/:id',
    title: 'Your pass · Shoreline Residences',
    loadComponent: () => import('./features/guest-pass/guest-pass.page').then((m) => m.GuestPassPage),
  },
  {
    path: 'sign-in',
    title: 'Sign in · Shoreline Access',
    loadComponent: () => import('./features/sign-in/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: '',
    component: AdminShell,
    // Cosmetic demo sign-in; the guest pass above stays public like a real guest link.
    canActivate: [requireDemoSession],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Overview · Shoreline Access',
        data: { breadcrumb: 'Overview' },
        loadComponent: () => import('./features/overview/overview.page').then((m) => m.OverviewPage),
      },
      {
        path: 'people',
        title: 'Guests & residents · Shoreline Access',
        data: { breadcrumb: 'Guests & residents' },
        loadComponent: () => import('./features/people/people.page').then((m) => m.PeoplePage),
      },
      {
        path: 'sync',
        title: 'Sync center · Shoreline Access',
        data: { breadcrumb: 'Sync center' },
        loadComponent: () => import('./features/sync/sync.page').then((m) => m.SyncPage),
      },
      {
        path: 'access-points',
        title: 'Access points · Shoreline Access',
        data: { breadcrumb: 'Access points' },
        loadComponent: () => import('./features/access-points/access-points.page').then((m) => m.AccessPointsPage),
      },
      {
        path: 'activity',
        title: 'Activity · Shoreline Access',
        data: { breadcrumb: 'Activity' },
        loadComponent: () => import('./features/activity/activity.page').then((m) => m.ActivityPage),
      },
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
