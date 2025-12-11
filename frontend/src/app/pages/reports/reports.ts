import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, Subscription, forkJoin } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { DuyuruService } from '../../services/duyuru-api/duyuru';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit, OnDestroy {
  istatistikler: { toplamDuyuru: number, toplamOkunma: number } = { toplamDuyuru: 0, toplamOkunma: 0 };
  duyuruListesi: any[] = [];
  filteredDuyuruListesi: any[] = [];

  // Arama
  searchQuery = '';
  private searchChange$ = new Subject<string>();
  private searchSub?: Subscription;

  // Sıralama
  sortOrder: 'id-desc' | 'id-asc' | 'new-to-old' | 'old-to-new' | 'most-read' | 'least-read' | 'priority-high-low' | 'priority-low-high' = 'id-desc';

  // Modal
  isModalActive = false;
  modalDuyuruBasligi = '';
  modalOkuyanlarListesi: any[] = [];
  modalLoading = false;

  message = '';
  private destroy$ = new Subject<void>();

  // Dashboard Charts
  totalDuyuruCount = 0;
  totalActiveDuyuruCount = 0;
  departmentChart: any;
  activeDepartmentChart: any;
  departmentList: any[] = [];

  constructor(private duyuruService: DuyuruService) { }

  ngOnInit(): void {
    this.loadRaporlar();

    // Debounced search
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
    if (this.departmentChart) this.departmentChart.destroy();
    if (this.activeDepartmentChart) this.activeDepartmentChart.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRaporlar(): void {
    this.message = '';
    forkJoin({
      stats: this.duyuruService.getRaporIstatistikler(),
      list: this.duyuruService.getRaporDuyuruListesi(),
      departments: this.duyuruService.getDepartmanlar()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.istatistikler = results.stats;
          this.duyuruListesi = results.list;
          this.departmentList = results.departments;
          this.calculateDashboardStats();
          this.applySearchAndSort();
        },
        error: (err) => {
          console.error('Rapor verileri yüklenirken hata:', err);
          this.message = 'Rapor verileri yüklenirken hata oluştu: ' + err.message;
        }
      });
  }

  onSearchChange(value: string): void {
    this.searchChange$.next(value);
  }

  performSearch(): void {
    this.applySearchAndSort();
  }

  onSortChange(): void {
    this.applySearchAndSort();
  }

  // Filtreleme
  selectedDepartment: number | null = null;

  onDepartmentFilterChange(deptId: string): void {
    this.selectedDepartment = deptId ? Number(deptId) : null;
    this.applySearchAndSort();
  }

  private applySearchAndSort(): void {
    const query = this.searchQuery.trim().toLowerCase();

    // Arama
    if (query.length >= 2) {
      this.filteredDuyuruListesi = this.duyuruListesi.filter(duyuru => {
        const matchesQuery = duyuru.baslik?.toLowerCase().includes(query) ||
          duyuru.olusturan_isim?.toLowerCase().includes(query);

        const matchesDept = !this.selectedDepartment || (duyuru.departmanlar && Array.isArray(duyuru.departmanlar) &&
          duyuru.departmanlar.some((d: any) => (d.id || d) == this.selectedDepartment));

        return matchesQuery && matchesDept;
      });
    } else {
      // Sadece departman filtresi
      if (this.selectedDepartment) {
        this.filteredDuyuruListesi = this.duyuruListesi.filter(duyuru =>
          duyuru.departmanlar && Array.isArray(duyuru.departmanlar) &&
          duyuru.departmanlar.some((d: any) => (d.id || d) == this.selectedDepartment)
        );
      } else {
        this.filteredDuyuruListesi = [...this.duyuruListesi];
      }
    }

    // Sıralama
    this.sortFilteredList();
  }

  private sortFilteredList(): void {
    switch (this.sortOrder) {
      case 'id-desc':
        this.filteredDuyuruListesi.sort((a, b) => (b.id || 0) - (a.id || 0));
        break;
      case 'id-asc':
        this.filteredDuyuruListesi.sort((a, b) => (a.id || 0) - (b.id || 0));
        break;
      case 'new-to-old':
        this.filteredDuyuruListesi.sort((a, b) =>
          new Date(b.duyuru_baslangic_tarihi).getTime() - new Date(a.duyuru_baslangic_tarihi).getTime()
        );
        break;
      case 'old-to-new':
        this.filteredDuyuruListesi.sort((a, b) =>
          new Date(a.duyuru_baslangic_tarihi).getTime() - new Date(b.duyuru_baslangic_tarihi).getTime()
        );
        break;
      case 'most-read':
        this.filteredDuyuruListesi.sort((a, b) =>
          (b.okunma_sayisi || 0) - (a.okunma_sayisi || 0)
        );
        break;
      case 'least-read':
        this.filteredDuyuruListesi.sort((a, b) =>
          (a.okunma_sayisi || 0) - (b.okunma_sayisi || 0)
        );
        break;
      case 'priority-high-low':
        this.filteredDuyuruListesi.sort((a, b) =>
          (b.oncelik || 0) - (a.oncelik || 0)
        );
        break;
      case 'priority-low-high':
        this.filteredDuyuruListesi.sort((a, b) =>
          (a.oncelik || 0) - (b.oncelik || 0)
        );
        break;
    }
  }

  openModal(duyuruId: number, duyuruBasligi: string): void {
    this.isModalActive = true;
    this.modalDuyuruBasligi = duyuruBasligi;
    this.modalOkuyanlarListesi = [];
    this.modalLoading = true;

    this.duyuruService.getRaporOkumaDetaylari(duyuruId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.modalOkuyanlarListesi = data;
          this.modalLoading = false;
        },
        error: (err) => {
          console.error('Okuma detayları alınamadı:', err);
          this.message = 'Okuma detayları alınamadı: ' + err.message;
          this.modalLoading = false;
        }
      });
  }

  closeModal(): void {
    this.isModalActive = false;
  }

  getDepartmentNames(duyuru: any): string {
    const departmanlar = duyuru.departmanlar || [];
    if (departmanlar.length === 0) return 'Genel';
    return departmanlar.map((d: any) => d.departman_adi).join(', ');
  }

  isExpired(duyuru: any): boolean {
    if (!duyuru.duyuru_bitis_tarihi) return false;
    return new Date(duyuru.duyuru_bitis_tarihi) < new Date();
  }

  isActive(duyuru: any): boolean {
    const now = new Date();
    const start = duyuru.duyuru_baslangic_tarihi ? new Date(duyuru.duyuru_baslangic_tarihi) : null;
    const end = duyuru.duyuru_bitis_tarihi ? new Date(duyuru.duyuru_bitis_tarihi) : null;

    if (start && start > now) return false;
    if (end && end < now) return false;

    // Bitiş gelmemiş (ve/veya süresiz) ve başlamış -> Aktif (Listelenen)
    return true;
  }

  getDuyuruStatus(duyuru: any): 'active' | 'expired' | 'future' {
    const now = new Date();
    const start = duyuru.duyuru_baslangic_tarihi ? new Date(duyuru.duyuru_baslangic_tarihi) : null;
    const end = duyuru.duyuru_bitis_tarihi ? new Date(duyuru.duyuru_bitis_tarihi) : null;

    if (end && end < now) return 'expired';
    if (start && start > now) return 'future';
    return 'active';
  }

  calculateDashboardStats(): void {
    this.totalDuyuruCount = this.duyuruListesi.length;
    this.totalActiveDuyuruCount = this.duyuruListesi.filter(d => this.isActive(d)).length;

    const deptCounts = new Map<string, number>();
    this.duyuruListesi.forEach(duyuru => {
      if (duyuru.departmanlar && Array.isArray(duyuru.departmanlar) && duyuru.departmanlar.length > 0) {
        duyuru.departmanlar.forEach((dept: any) => {
          const deptName = dept.departman_adi || 'Bilinmeyen';
          deptCounts.set(deptName, (deptCounts.get(deptName) || 0) + 1);
        });
      } else {
        // Tüm departmanlara dağıt
        this.departmentList.forEach(dept => {
          const deptName = dept.departman_adi || dept.name || 'Bilinmeyen';
          deptCounts.set(deptName, (deptCounts.get(deptName) || 0) + 1);
        });
      }
    });

    const activeDeptCounts = new Map<string, number>();
    // Listelenen (Aktif / Süresi Dolmamış) duyurular
    this.duyuruListesi.filter(d => this.isActive(d)).forEach(duyuru => {
      if (duyuru.departmanlar && Array.isArray(duyuru.departmanlar) && duyuru.departmanlar.length > 0) {
        duyuru.departmanlar.forEach((dept: any) => {
          const deptName = dept.departman_adi || 'Bilinmeyen';
          activeDeptCounts.set(deptName, (activeDeptCounts.get(deptName) || 0) + 1);
        });
      } else {
        // Tüm departmanlara dağıt
        this.departmentList.forEach(dept => {
          const deptName = dept.departman_adi || dept.name || 'Bilinmeyen';
          activeDeptCounts.set(deptName, (activeDeptCounts.get(deptName) || 0) + 1);
        });
      }
    });

    setTimeout(() => {
      this.renderDepartmentChart(deptCounts);
      this.renderActiveDepartmentChart(activeDeptCounts);
    }, 100);
  }

  renderDepartmentChart(data: Map<string, number>): void {
    const canvas = document.getElementById('departmentChart') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.departmentChart) this.departmentChart.destroy();

    const labels = Array.from(data.keys());
    const counts = Array.from(data.values());

    this.departmentChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: this.generateColors(counts.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: { display: false },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold' },
            formatter: (value: any, ctx: any) => {
              const dataset = ctx.chart.data.datasets[0];
              const total = (dataset.data as number[]).reduce((acc: number, curr: number) => acc + curr, 0);
              return ((value / total) * 100).toFixed(1) + '%';
            }
          }
        }
      }
    });
  }

  renderActiveDepartmentChart(data: Map<string, number>): void {
    const canvas = document.getElementById('activeDepartmentChart') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.activeDepartmentChart) this.activeDepartmentChart.destroy();

    const labels = Array.from(data.keys());
    const counts = Array.from(data.values());

    this.activeDepartmentChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: this.generateColors(counts.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: { display: false },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold' },
            formatter: (value: any, ctx: any) => {
              const dataset = ctx.chart.data.datasets[0];
              const total = (dataset.data as number[]).reduce((acc: number, curr: number) => acc + curr, 0);
              return ((value / total) * 100).toFixed(1) + '%';
            }
          }
        }
      }
    });
  }

  generateColors(count: number): string[] {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
      '#EA80FC', '#8C9EFF', '#B388FF', '#FF8A80', '#CCFF90', '#A7FFEB'
    ];
    while (colors.length < count) {
      colors.push('#' + Math.floor(Math.random() * 16777215).toString(16));
    }
    return colors.slice(0, count);
  }
}
