import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    loadChildren: () =>
      import('./pages/login/login.module').then((m) => m.LoginPageModule),
  },

  {
    path: 'tabs',
    loadChildren: () =>
      import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./pages/profile/profile.module').then((m) => m.ProfilePageModule),
  },
  {
    path: 'requests',
    loadChildren: () =>
      import('./pages/requests/requests.module').then((m) => m.RequestsPageModule),
  },
  {
    path: 'journal/:jid/report',
    loadChildren: () =>
      import('./pages/cash-report/cash-report.module').then(
        (m) => m.CashReportPageModule
      ),
  },
  { path: '**', redirectTo: 'login' },
  {
    path: 'cash-report',
    loadChildren: () =>
      import('./pages/cash-report/cash-report.module').then(
        (m) => m.CashReportPageModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
