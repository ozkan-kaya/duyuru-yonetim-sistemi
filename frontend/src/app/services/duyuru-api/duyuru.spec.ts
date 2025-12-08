import { TestBed } from '@angular/core/testing';

import { Duyuru } from './duyuru';

describe('Duyuru', () => {
  let service: Duyuru;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Duyuru);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
