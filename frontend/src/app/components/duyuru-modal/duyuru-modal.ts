import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Duyuru } from '../../interfaces/duyuru-interface';

@Component({
  selector: 'app-duyuru-modal',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './duyuru-modal.html',
  styleUrls: ['./duyuru-modal.css'],
})

export class DuyuruModal {
  @Input() duyuru: Duyuru | null = null;
  @Input() isActive = false;
  @Output() modalClose = new EventEmitter<void>();

  close(): void {
    this.modalClose.emit();
  }

  isExpired(): boolean {
    if (!this.duyuru?.duyuru_bitis_tarihi) {
      return false;
    }
    return new Date(this.duyuru.duyuru_bitis_tarihi) < new Date();
  }

  getDepartmentNames(): string {
    const departmanlar = this.duyuru?.departmanlar || [];
    if (departmanlar.length === 0) return 'Departman yok';
    return departmanlar.map((d: any) => d.departman_adi || d.name).join(', ');
  }
}
