import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { canActivateDuyuruYonetimi, canActivateLoggedIn, canActivateRaporlama } from './services/auth/auth-guard';
import { NotFound } from './pages/not-found/not-found';

export const routes: Routes = [
  // Eager Loaded Routes
  {
    path: 'login',
    component: Login,
    data: { showNavbar: false }
  },
  {
    path: '',
    component: Home,
    canActivate: [canActivateLoggedIn]
  },

  // Lazy Loaded Routes
  {
    path: 'profil',
    loadComponent: () => import('./pages/profile/profile').then(m => m.Profile),
    canActivate: [canActivateLoggedIn]
  },
  {
    path: 'raporlar',
    loadComponent: () => import('./pages/reports/reports').then(m => m.Reports),
    canActivate: [canActivateRaporlama],
  },
  {
    path: 'duyuru-yonetimi',
    loadComponent: () => import('./pages/duyuru-yonetimi/duyuru-yonetimi').then(m => m.DuyuruYonetimi),
    canActivate: [canActivateDuyuruYonetimi]
  },

  // Wildcard route
  { path: '**', component: NotFound }
];
