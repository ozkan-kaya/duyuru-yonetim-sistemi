import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

// Auth-Guard yetkisiz erişimleri login veya anasayfaya yönlendirmek amacıyla kullanılır.

export const canActivateLoggedIn: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

// Raporlama: admin (her şeye erişir), duyuru_raporlama veya duyuru_yonetimi yetkisi gerekli
export const canActivateRaporlama: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.canViewReports()) {
    return true;
  }

  console.warn('Auth Guard: Yetkisiz erişim - Rapor görüntüleme yetkisi gerekli');
  router.navigate(['/']);
  return false;
};

// Duyuru Yönetimi: admin (her şeye erişir) veya duyuru_yonetimi yetkisi gerekli
export const canActivateDuyuruYonetimi: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.canManageAnnouncements()) {
    return true;
  }

  console.warn('Auth Guard: Yetkisiz erişim - Duyuru yönetimi yetkisi gerekli');
  router.navigate(['/']);
  return false;
};
