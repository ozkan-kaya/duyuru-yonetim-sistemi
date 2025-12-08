import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Duyuru, DuyuruCreateDto, DuyuruUpdateDto } from '../../interfaces/duyuru-interface';

@Injectable({
  providedIn: 'root'
})
export class DuyuruService {

  private baseApiUrl = `${environment.apiUrl}/api`;
  private duyurularApiUrl = `${this.baseApiUrl}/duyurular`;
  private raporlarApiUrl = `${this.baseApiUrl}/raporlar`;

  constructor(private http: HttpClient) { }

  getDepartmanlar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseApiUrl}/departmanlar`);
  }

  getDuyurular(): Observable<Duyuru[]> {
    return this.http.get<Duyuru[]>(this.duyurularApiUrl);
  }

  addDuyuru(duyuruData: DuyuruCreateDto): Observable<any> {
    return this.http.post<any>(this.duyurularApiUrl, duyuruData);
  }

  updateDuyuru(id: number, duyuruData: DuyuruUpdateDto): Observable<any> {
    return this.http.put<any>(`${this.duyurularApiUrl}/${id}`, duyuruData);
  }

  deleteDuyuru(id: number): Observable<any> {
    return this.http.patch<any>(`${this.duyurularApiUrl}/${id}/delete`, {});
  }

  markAsRead(id: number): Observable<any> {
    return this.http.post<any>(`${this.duyurularApiUrl}/${id}/oku`, {});
  }

  searchDuyurular(query: string): Observable<Duyuru[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<Duyuru[]>(`${this.duyurularApiUrl}/arama`, { params });
  }

  getKullaniciAktiviteleri(): Observable<Duyuru[]> {
    return this.http.get<Duyuru[]>(`${this.duyurularApiUrl}/kullanici-aktiviteleri`);
  }

  getRaporIstatistikler(): Observable<{ toplamDuyuru: number, toplamOkunma: number }> {
    return this.http.get<{ toplamDuyuru: number, toplamOkunma: number }>(`${this.raporlarApiUrl}/genel-istatistikler`);
  }

  getRaporDuyuruListesi(): Observable<any[]> {
    return this.http.get<any[]>(`${this.raporlarApiUrl}/duyuru-listesi`);
  }

  getRaporOkumaDetaylari(duyuruId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.raporlarApiUrl}/okuma-detaylari/${duyuruId}`);
  }
}
