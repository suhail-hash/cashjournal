import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CashReportPageRoutingModule } from './cash-report-routing.module';

import { CashReportPage } from './cash-report.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    CashReportPageRoutingModule
  ],
  declarations: [CashReportPage]
})
export class CashReportPageModule {}
