import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DuyuruService } from '../../services/duyuru-api/duyuru';
import { Duyuru } from '../../interfaces/duyuru-interface';

@Component({
  selector: 'app-duyuru-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './duyuru-card.html',
  styleUrl: './duyuru-card.css'
})
export class DuyuruCard {
  @Input() duyuru!: Duyuru;
  @Input() totalDepartments: number = 0;
  @Output() cardClick = new EventEmitter<Duyuru>();

  constructor(private duyuruService: DuyuruService) { }

  onCardClick(): void {
    console.log('Kart tıklandı - Duyuru:', this.duyuru.id, 'Okundu:', this.duyuru.okundu, 'Tip:', typeof this.duyuru.okundu);

    // Kartı tıklandığında duyuruyu parent'a emit et
    this.cardClick.emit(this.duyuru);

    // Okundu olarak işaretle
    if (!this.duyuru.okundu) {
      this.duyuruyuOkunduIsaretle();
    }
  }

  private duyuruyuOkunduIsaretle(): void {
    if (!this.duyuru?.id) return;

    this.duyuruService.markAsRead(this.duyuru.id).subscribe({
      next: (response) => {
        console.log('Duyuru okundu olarak işaretlendi:', response.message);
        this.duyuru.okundu = true;
      },
      error: (error) => {
        console.error('Duyuru okundu işaretlenirken hata:', error);
      }
    });
  }

  getDepartmentNames(): string {
    const departmanlar = this.duyuru.departmanlar || [];
    return departmanlar.map((d: any) => d.departman_adi || d.name).join(', ');
  }
}
