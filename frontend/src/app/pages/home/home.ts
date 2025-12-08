import { Component } from '@angular/core';
import { DuyuruCardList } from '../../components/duyuru-card-list/duyuru-card-list';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DuyuruCardList],
  templateUrl: './home.html',
})
export class Home {
}
