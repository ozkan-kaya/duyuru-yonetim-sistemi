import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DuyuruModal } from './duyuru-modal';

describe('DuyuruModal', () => {
  let component: DuyuruModal;
  let fixture: ComponentFixture<DuyuruModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DuyuruModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DuyuruModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
