import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DuyuruService } from '../../services/duyuru-api/duyuru';
import { DuyuruCard } from '../duyuru-card/duyuru-card';
import { DuyuruModal } from '../duyuru-modal/duyuru-modal';
import { Duyuru } from '../../interfaces/duyuru-interface';

@Component({
  selector: 'app-duyuru-card-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DuyuruCard, DuyuruModal],
  templateUrl: './duyuru-card-list.html',
  styleUrls: ['./duyuru-card-list.css']
})
export class DuyuruCardList {

  duyurular = signal<Duyuru[]>([]);
  totalDepartments = signal(0);

  searchText = signal('');
  debouncedSearchText = signal('');
  oncelikFilter = signal<number | null>(null);
  departmanFilter = signal<number | null>(null);
  departmanlar: any[] = [];
  tarihStart = signal<string | null>(null);
  tarihEnd = signal<string | null>(null);
  sortField = signal('tarih');
  sortDir = signal('desc');

  showFilters = signal(false);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(6);

  // Modal
  selectedDuyuru = signal<Duyuru | null>(null);
  isModalActive = signal(false);

  private searchTimeout?: number;

  constructor(private duyuruService: DuyuruService) {
    this.loadDepartmanlar();
    this.loadDuyurular();
    this.setupSearchDebounce();
  }

  setupSearchDebounce() {
    effect(() => {
      const search = this.searchText();

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      this.searchTimeout = window.setTimeout(() => {
        this.debouncedSearchText.set(search);
        this.currentPage.set(1);
      }, 300);
    });
  }

  loadDepartmanlar() {
    this.duyuruService.getDepartmanlar().subscribe({
      next: data => {
        this.departmanlar = data;
        this.totalDepartments.set(data.length);
      },
      error: err => console.error(err)
    });
  }

  loadDuyurular() {
    this.duyuruService.getDuyurular().subscribe({
      next: data => this.duyurular.set(data),
      error: err => console.error(err)
    });
  }

  toggleFilters() {
    this.showFilters.set(!this.showFilters());
  }

  clearFilters() {
    this.searchText.set('');
    this.oncelikFilter.set(null);
    this.departmanFilter.set(null);
    this.tarihStart.set(null);
    this.tarihEnd.set(null);
    this.currentPage.set(1);
  }

  onDuyuruClick(duyuru: Duyuru): void {
    this.selectedDuyuru.set(duyuru);
    setTimeout(() => {
      this.isModalActive.set(true);
    }, 0);
  }

  closeModal(): void {
    this.isModalActive.set(false);
  }

  filteredDuyurular = computed(() => {
    let temp = [...this.duyurular()];

    // Süresi dolmuş duyuruları filtrele
    const now = new Date();
    temp = temp.filter(d => {
      // Başlangıç tarihi gelecekteyse (henüz gelmediyse) gösterme
      if (d.duyuru_baslangic_tarihi) {
        const start = new Date(d.duyuru_baslangic_tarihi);
        if (start > now) return false;
      }

      // Bitiş tarihi geçmişse gösterme
      if (d.duyuru_bitis_tarihi) {
        return new Date(d.duyuru_bitis_tarihi) >= now;
      }
      return true;
    });

    // Arama (debounced)
    if (this.debouncedSearchText().trim()) {
      const q = this.debouncedSearchText().toLowerCase();
      temp = temp.filter(d => d.baslik.toLowerCase().includes(q) || d.aciklama.toLowerCase().includes(q));
    }

    // Öncelik
    if (this.oncelikFilter() !== null) {
      temp = temp.filter(d => d.oncelik === this.oncelikFilter());
    }

    // Departman
    if (this.departmanFilter() !== null) {
      temp = temp.filter(d => {
        const departmanlar = d.departmanlar || [];
        return departmanlar.some((dept: any) => dept.id === this.departmanFilter());
      });
    }

    // Tarih aralığı
    if (this.tarihStart()) {
      const start = new Date(this.tarihStart()!);
      temp = temp.filter(d => new Date(d.duyuru_baslangic_tarihi || '').getTime() >= start.getTime());
    }
    if (this.tarihEnd()) {
      const end = new Date(this.tarihEnd()!);
      temp = temp.filter(d => new Date(d.duyuru_baslangic_tarihi || '').getTime() <= end.getTime());
    }

    // Sıralama
    temp.sort((a, b) => {
      let comp = 0;
      if (this.sortField() === 'tarih') {
        comp = new Date(a.duyuru_baslangic_tarihi || '').getTime() - new Date(b.duyuru_baslangic_tarihi || '').getTime();
      } else if (this.sortField() === 'oncelik') {
        comp = a.oncelik - b.oncelik;
      }
      return this.sortDir() === 'asc' ? comp : -comp;
    });

    return temp;
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredDuyurular().length / this.pageSize());
  });

  pages = computed(() =>
    Array.from({ length: this.totalPages() })
  );

  paginatedDuyurular = computed(() => {
    const filtered = this.filteredDuyurular();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return filtered.slice(start, end);
  });

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }
}
