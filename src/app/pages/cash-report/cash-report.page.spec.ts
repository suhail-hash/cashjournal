import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashReportPage } from './cash-report.page';

describe('CashReportPage', () => {
  let component: CashReportPage;
  let fixture: ComponentFixture<CashReportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CashReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
