import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DuyuruService } from '../../services/duyuru-api/duyuru';
import { AuthService } from '../../services/auth/auth';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { Duyuru, DuyuruCreateDto, DuyuruUpdateDto, Departman } from '../../interfaces/duyuru-interface';

@Component({
  selector: 'app-duyuru-yonetimi',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, FormsModule],
  templateUrl: './duyuru-yonetimi.html',
  styleUrl: './duyuru-yonetimi.css'
})
export class DuyuruYonetimi implements OnInit, OnDestroy {
  duyuruForm: FormGroup;
  uploading = false;
  message = '';

  duyurular: Duyuru[] = [];
  filteredDuyurular: Duyuru[] = [];
  departmanlar: Departman[] = [];
  isModalActive = false;
  isEditMode = false;
  editingId: number | null = null;
  currentUserId: number | null = null;

  // Arama
  searchQuery = '';
  private searchChange$ = new Subject<string>();
  private searchSub?: Subscription;

  // Sıralama
  sortOrder: string = 'id-desc'; // Default to ID descending

  // Filtreleme
  selectedDepartment: number | null = null;

  originalFormValue: any = null;

  get isFormChanged(): boolean {
    if (!this.originalFormValue) return false;

    const current = this.duyuruForm.getRawValue();
    const original = this.originalFormValue;

    if (current.baslik !== original.baslik ||
      current.aciklama !== original.aciklama ||
      current.duyuru_baslangic_tarihi !== original.duyuru_baslangic_tarihi ||
      current.duyuru_bitis_tarihi !== original.duyuru_bitis_tarihi ||
      current.oncelik !== original.oncelik) {
      return true;
    }

    // Departman karşılaştırması (sıralama bağımsız)
    const currentDepts = [...(current.departmanlar || [])].sort((a: number, b: number) => a - b);
    const originalDepts = [...(original.departmanlar || [])].sort((a: number, b: number) => a - b);

    return JSON.stringify(currentDepts) !== JSON.stringify(originalDepts);
  }

  get isFormDirtyOrFileSelected(): boolean {
    return this.isFormChanged;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private duyuruService: DuyuruService,
    private authService: AuthService
  ) {
    this.duyuruForm = this.fb.group({
      baslik: ['', [Validators.required, Validators.maxLength(75)]],
      aciklama: ['', Validators.required],
      departmanlar: [[], Validators.required],
      oncelik: [2, Validators.required],
      duyuru_baslangic_tarihi: [''],
      duyuru_bitis_tarihi: ['']
    });
  }

  get baslikControl() {
    return this.duyuruForm.get('baslik');
  }

  ngOnInit(): void {
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (user) => {
        if (user && user.id) {
          this.currentUserId = user.id;
        }
      }
    });

    this.loadDepartmanlar();
    this.loadDuyurular();

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
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepartmanlar(): void {
    this.duyuruService.getDepartmanlar().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.departmanlar = data;
      },
      error: (error) => {
        console.error('Departmanlar yüklenirken hata:', error);
        this.message = 'Departmanlar yüklenirken hata oluştu.';
      }
    });
  }

  loadDuyurular(): void {
    this.duyuruService.getDuyurular().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Duyuru[]) => {
        this.duyurular = data;
        this.applySearchAndSort();
      },
      error: (error) => {
        console.error('Duyurular yüklenirken hata:', error);
        this.message = 'Duyurular yüklenirken hata oluştu: ' + error.message;
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

  onDepartmentFilterChange(deptId: string): void {
    this.selectedDepartment = deptId ? Number(deptId) : null;
    this.applySearchAndSort();
  }

  private applySearchAndSort(): void {
    const query = this.searchQuery.trim().toLowerCase();

    // Arama
    // Arama
    if (query.length >= 2) {
      this.filteredDuyurular = this.duyurular.filter(duyuru => {
        const departmanAdlari = (duyuru.departmanlar || []).map((d: any) => d.departman_adi?.toLowerCase()).join(' ');
        const matchesQuery = duyuru.baslik?.toLowerCase().includes(query) ||
          duyuru.aciklama?.toLowerCase().includes(query) ||
          departmanAdlari.includes(query) ||
          duyuru.id?.toString().includes(query);

        const matchesDept = !this.selectedDepartment || (duyuru.departmanlar || []).some((d: any) => (d.id || d) == this.selectedDepartment);

        return matchesQuery && matchesDept;
      });
    } else {
      // Sadece departman filtresi varsa
      if (this.selectedDepartment) {
        this.filteredDuyurular = this.duyurular.filter(duyuru =>
          (duyuru.departmanlar || []).some((d: any) => (d.id || d) == this.selectedDepartment)
        );
      } else {
        this.filteredDuyurular = [...this.duyurular];
      }
    }

    // Sıralama
    this.sortFilteredList();
  }

  private sortFilteredList(): void {
    switch (this.sortOrder) {
      case 'id-desc':
        this.filteredDuyurular.sort((a, b) => (b.id || 0) - (a.id || 0));
        break;
      case 'id-asc':
        this.filteredDuyurular.sort((a, b) => (a.id || 0) - (b.id || 0));
        break;
      case 'new-to-old':
        this.filteredDuyurular.sort((a, b) =>
          new Date(b.duyuru_baslangic_tarihi || '').getTime() - new Date(a.duyuru_baslangic_tarihi || '').getTime()
        );
        break;
      case 'old-to-new':
        this.filteredDuyurular.sort((a, b) =>
          new Date(a.duyuru_baslangic_tarihi || '').getTime() - new Date(b.duyuru_baslangic_tarihi || '').getTime()
        );
        break;
      case 'priority-high-low':
        this.filteredDuyurular.sort((a, b) =>
          (b.oncelik || 0) - (a.oncelik || 0)
        );
        break;
      case 'priority-low-high':
        this.filteredDuyurular.sort((a, b) =>
          (a.oncelik || 0) - (b.oncelik || 0)
        );
        break;
    }
  }

  openModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.message = '';
    this.duyuruForm.reset({ departmanlar: [], oncelik: 2 });
    this.duyuruForm.markAsPristine();
    this.duyuruForm.markAsUntouched();
    this.originalFormValue = null;
    this.isModalActive = true;
  }

  openUpdateModal(duyuru: Duyuru): void {
    this.isEditMode = true;
    this.editingId = duyuru.id;
    this.message = '';

    // Bitiş ve başlangıç tarihlerini düzenle
    let baslangicTarihi = '';
    let bitisTarihi = '';

    if (duyuru.duyuru_baslangic_tarihi) {
      const date = new Date(duyuru.duyuru_baslangic_tarihi);
      baslangicTarihi = date.toISOString().split('T')[0];
    }

    if (duyuru.duyuru_bitis_tarihi) {
      const date = new Date(duyuru.duyuru_bitis_tarihi);
      bitisTarihi = date.toISOString().split('T')[0];
    }

    // Departman ID'leri
    const departmanlar = (duyuru.departmanlar || []).map((d: any) => d.id || d);

    // Önce form'u resetle
    this.duyuruForm.reset();

    // Sonra değerleri set et
    this.duyuruForm.patchValue({
      baslik: duyuru.baslik,
      aciklama: duyuru.aciklama,
      departmanlar: departmanlar,
      oncelik: duyuru.oncelik,
      duyuru_baslangic_tarihi: baslangicTarihi,
      duyuru_bitis_tarihi: bitisTarihi
    });

    this.originalFormValue = this.duyuruForm.getRawValue();
    this.duyuruForm.markAsPristine();
    this.duyuruForm.markAsUntouched();

    this.isModalActive = true;
  }

  closeModal(): void {
    this.isModalActive = false;
    this.isEditMode = false;
    this.editingId = null;
    this.duyuruForm.reset({ departmanlar: [], oncelik: 2 });
    this.duyuruForm.markAsPristine();
    this.duyuruForm.markAsUntouched();
    this.originalFormValue = null;
    this.message = '';
  }

  onSubmit(): void {
    if (this.duyuruForm.invalid) {
      this.message = 'Lütfen tüm zorunlu alanları doldurun.';
      return;
    }

    const formValue = this.duyuruForm.value;

    // Tarih kontrolü
    if (formValue.duyuru_baslangic_tarihi && formValue.duyuru_bitis_tarihi) {
      const start = new Date(formValue.duyuru_baslangic_tarihi);
      const end = new Date(formValue.duyuru_bitis_tarihi);
      if (start > end) {
        this.message = 'Başlangıç tarihi bitiş tarihinden büyük olamaz.';
        return;
      }
    }

    this.uploading = true;
    this.message = 'İşlem yürütülüyor...';

    if (this.isEditMode && this.editingId) {
      const updateData: any = {
        baslik: formValue.baslik,
        aciklama: formValue.aciklama,
        departmanlar: formValue.departmanlar,
        oncelik: formValue.oncelik,
        duyuru_baslangic_tarihi: formValue.duyuru_baslangic_tarihi || null,
        duyuru_bitis_tarihi: formValue.duyuru_bitis_tarihi || null
      };

      this.duyuruService.updateDuyuru(this.editingId, updateData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.uploading = false;
            this.message = 'Duyuru başarıyla güncellendi!';
            this.loadDuyurular();
            setTimeout(() => this.closeModal(), 1500);
          },
          error: (error) => {
            this.uploading = false;
            this.message = 'Güncelleme hatası: ' + error.message;
          }
        });
    } else {
      const createData: any = {
        baslik: formValue.baslik,
        aciklama: formValue.aciklama,
        departmanlar: formValue.departmanlar,
        oncelik: formValue.oncelik,
        duyuru_baslangic_tarihi: formValue.duyuru_baslangic_tarihi || null,
        duyuru_bitis_tarihi: formValue.duyuru_bitis_tarihi || null
      };

      this.duyuruService.addDuyuru(createData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.uploading = false;
            this.message = 'Duyuru başarıyla eklendi!';
            this.loadDuyurular();
            setTimeout(() => this.closeModal(), 1500);
          },
          error: (error) => {
            this.uploading = false;
            this.message = 'Hata oluştu: ' + error.message;
          }
        });
    }
  }

  deleteDuyuru(id: number, baslik: string): void {
    if (confirm(`'${baslik}' başlıklı duyuruyu silmek istediğinizden emin misiniz?`)) {
      this.duyuruService.deleteDuyuru(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.message = 'Duyuru başarıyla silindi!';
          this.loadDuyurular();
        },
        error: (error) => {
          this.message = 'Duyuru silinirken bir hata oluştu: ' + error.message;
        }
      });
    }
  }

  isDepartmentSelected(id: number): boolean {
    const selectedDepartments = this.duyuruForm.get('departmanlar')?.value || [];
    return selectedDepartments.includes(id);
  }

  toggleDepartment(id: number): void {
    const currentSelection = this.duyuruForm.get('departmanlar')?.value || [];
    let newSelection: number[];

    if (currentSelection.includes(id)) {
      // Remove
      newSelection = currentSelection.filter((deptId: number) => deptId !== id);
    } else {
      // Add
      newSelection = [...currentSelection, id];
    }

    this.duyuruForm.patchValue({ departmanlar: newSelection });
  }

  selectAllDepartments(): void {
    const allIds = this.departmanlar.map(d => d.id);
    this.duyuruForm.patchValue({ departmanlar: allIds });
    this.duyuruForm.markAsDirty();
  }

  deselectAllDepartments(): void {
    this.duyuruForm.patchValue({ departmanlar: [] });
    this.duyuruForm.markAsDirty();
  }

  getDuyuruStatus(duyuru: any): 'active' | 'expired' | 'future' {
    const now = new Date();
    const start = duyuru.duyuru_baslangic_tarihi ? new Date(duyuru.duyuru_baslangic_tarihi) : null;
    const end = duyuru.duyuru_bitis_tarihi ? new Date(duyuru.duyuru_bitis_tarihi) : null;

    if (end && end < now) return 'expired';
    if (start && start > now) return 'future';
    return 'active';
  }

  // Duyuru için departmanları formatla
  getDepartmentDisplay(duyuru: Duyuru): string {
    const departmanlar = duyuru.departmanlar || [];
    if (departmanlar.length === 0) return 'N/A';
    if (departmanlar.length === this.departmanlar.length) return 'Tüm Departmanlar';
    return departmanlar.map(d => d.departman_adi).join(', ');
  }

  isExpired(duyuru: Duyuru): boolean {
    if (!duyuru.duyuru_bitis_tarihi) return false;
    return new Date(duyuru.duyuru_bitis_tarihi) < new Date();
  }
}
