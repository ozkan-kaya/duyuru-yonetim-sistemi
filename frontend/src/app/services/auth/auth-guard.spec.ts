import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { canActivateLoggedIn, canActivateYonetici, canActivateAdmin } from '../auth-guard/auth-guard';
import { AuthService } from './auth';

describe('Auth Guards', () => {
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'getUserRole']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  describe('canActivateLoggedIn', () => {
    it('should allow access when user is logged in', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        canActivateLoggedIn({} as any, {} as any)
      );

      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should redirect to login when user is not logged in', () => {
      mockAuthService.isLoggedIn.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        canActivateLoggedIn({} as any, {} as any)
      );

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('canActivateYonetici', () => {
    it('should allow access for admin role', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);
      mockAuthService.getUserRole.and.returnValue('admin');

      const result = TestBed.runInInjectionContext(() =>
        canActivateYonetici({} as any, {} as any)
      );

      expect(result).toBe(true);
    });

    it('should allow access for yonetici role', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);
      mockAuthService.getUserRole.and.returnValue('yonetici');

      const result = TestBed.runInInjectionContext(() =>
        canActivateYonetici({} as any, {} as any)
      );

      expect(result).toBe(true);
    });

    it('should redirect to home for unauthorized role', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);
      mockAuthService.getUserRole.and.returnValue('user');

      const result = TestBed.runInInjectionContext(() =>
        canActivateYonetici({} as any, {} as any)
      );

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should redirect to login when not logged in', () => {
      mockAuthService.isLoggedIn.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        canActivateYonetici({} as any, {} as any)
      );

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('canActivateAdmin', () => {
    it('should allow access for admin role', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);
      mockAuthService.getUserRole.and.returnValue('admin');

      const result = TestBed.runInInjectionContext(() =>
        canActivateAdmin({} as any, {} as any)
      );

      expect(result).toBe(true);
    });

    it('should redirect to home for non-admin role', () => {
      mockAuthService.isLoggedIn.and.returnValue(true);
      mockAuthService.getUserRole.and.returnValue('yonetici');

      const result = TestBed.runInInjectionContext(() =>
        canActivateAdmin({} as any, {} as any)
      );

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should redirect to login when not logged in', () => {
      mockAuthService.isLoggedIn.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        canActivateAdmin({} as any, {} as any)
      );

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
