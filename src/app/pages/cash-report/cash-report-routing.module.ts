import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CashReportPage } from './cash-report.page';

const routes: Routes = [
  {
    path: '',
    component: CashReportPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CashReportPageRoutingModule {}
