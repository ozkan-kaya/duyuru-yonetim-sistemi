import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject, Subscription, takeUntil, map, debounceTime, distinctUntilChanged } from 'rxjs';
import { DuyuruService } from '../../services/duyuru-api/duyuru';
import { AuthService } from '../../services/auth/auth';
import { DuyuruModal } from '../../components/duyuru-modal/duyuru-modal';
import { Duyuru } from '../../interfaces/duyuru-interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, DuyuruModal, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {
  aktiviteler: Duyuru[] = [];
  filteredAktiviteler: Duyuru[] = [];
  message = '';
  currentUser: any | null = null;

  // Arama
  searchQuery = '';
  private searchChange$ = new Subject<string>();
  private searchSub?: Subscription;

  // Sıralama
  sortOrder: 'read-new-to-old' | 'read-old-to-new' | 'date-new-to-old' | 'date-old-to-new' | 'priority-high-low' | 'priority-low-high' = 'read-new-to-old';

  // Modal için
  selectedDuyuru: Duyuru | null = null;
  isModalActive = false;

  private destroy$ = new Subject<void>();

  constructor(
    private duyuruService: DuyuruService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Kullanıcı bilgisi zaten login'de alınmış, user$ observable'dan kullan
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
    });

    this.loadAktiviteler();

    // Search
    this.searchSub = this.searchChange$
      .pipe(
        map(v => (v || '').trim()),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applySearchAndSort();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAktiviteler(): void {
    this.duyuruService.getKullaniciAktiviteleri().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.aktiviteler = data;
        this.applySearchAndSort();
      },
      error: (error) => {
        console.error('Aktivite listesi yüklenirken hata:', error);
        this.message = 'Aktivite listesi yüklenirken hata oluştu.';
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchChange$.next(value);
  }

  onSortChange(): void {
    this.applySearchAndSort();
  }

  private applySearchAndSort(): void {
    const query = this.searchQuery.trim().toLowerCase();

    // Arama
    if (query.length >= 2) {
      this.filteredAktiviteler = this.aktiviteler.filter(aktivite => {
        return aktivite.baslik?.toLowerCase().includes(query) ||
          (aktivite.departmanlar && Array.isArray(aktivite.departmanlar) &&
            aktivite.departmanlar.some((d: any) => d.departman_adi?.toLowerCase().includes(query)));
      });
    } else {
      this.filteredAktiviteler = [...this.aktiviteler];
    }

    // Sıralama
    this.sortFilteredList();
  }

  private sortFilteredList(): void {
    switch (this.sortOrder) {
      case 'read-new-to-old':
        this.filteredAktiviteler.sort((a, b) =>
          new Date(b.okunma_tarihi || '').getTime() - new Date(a.okunma_tarihi || '').getTime()
        );
        break;
      case 'read-old-to-new':
        this.filteredAktiviteler.sort((a, b) =>
          new Date(a.okunma_tarihi || '').getTime() - new Date(b.okunma_tarihi || '').getTime()
        );
        break;
      case 'date-new-to-old':
        this.filteredAktiviteler.sort((a, b) =>
          new Date(b.duyuru_baslangic_tarihi || '').getTime() - new Date(a.duyuru_baslangic_tarihi || '').getTime()
        );
        break;
      case 'date-old-to-new':
        this.filteredAktiviteler.sort((a, b) =>
          new Date(a.duyuru_baslangic_tarihi || '').getTime() - new Date(b.duyuru_baslangic_tarihi || '').getTime()
        );
        break;
      case 'priority-high-low':
        this.filteredAktiviteler.sort((a, b) =>
          (b.oncelik || 0) - (a.oncelik || 0)
        );
        break;
      case 'priority-low-high':
        this.filteredAktiviteler.sort((a, b) =>
          (a.oncelik || 0) - (b.oncelik || 0)
        );
        break;
    }
  }

  getDepartmentNames(aktivite: any): string {
    const departmanlar = aktivite.departmanlar || [];
    if (departmanlar.length === 0) return 'Genel';
    return departmanlar.map((d: any) => d.departman_adi).join(', ');
  }

  openModal(duyuru: Duyuru): void {
    this.selectedDuyuru = duyuru;
    this.isModalActive = true;
  }

  closeModal(): void {
    this.isModalActive = false;
    this.selectedDuyuru = null;
  }
}
