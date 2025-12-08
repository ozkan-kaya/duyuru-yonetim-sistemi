export interface Departman {
  id: number;
  name: string;
  departman_adi?: string;
}

export interface Duyuru {
  id: number;
  baslik: string;
  aciklama: string;
  oncelik: 1 | 2 | 3; // 1: Düşük, 2: Orta, 3: Yüksek
  departmanlar?: Departman[];
  created_by: number;
  olusturan_isim?: string;
  duyuru_baslangic_tarihi?: string | Date;
  duyuru_bitis_tarihi?: string | Date | null;
  okundu?: boolean;
  okunma_tarihi?: string | Date;
}

export interface DuyuruCreateDto {
  baslik: string;
  aciklama: string;
  oncelik: 1 | 2 | 3;
  departmanlar: number[]; // Dept. ID'leri
  duyuru_baslangic_tarihi?: string | null;
  duyuru_bitis_tarihi?: string | null;
}

export interface DuyuruUpdateDto {
  baslik: string;
  aciklama: string;
  oncelik: 1 | 2 | 3;
  departmanlar: number[]; // Dept. ID'leri
  duyuru_baslangic_tarihi?: string | null;
  duyuru_bitis_tarihi?: string | null;
}
