import { Component, inject } from '@angular/core';
import { addIcons } from 'ionicons';
import { Router, NavigationEnd } from '@angular/router';
import { homeOutline } from 'ionicons/icons';
import { MenuController } from '@ionic/angular';
import { Auth, signOut } from '@angular/fire/auth';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private router = inject(Router);
  private menu = inject(MenuController);
  auth = inject(Auth);

  dark = false;
  confirmLogoutOpen = false;
  busyLogout = false;

  constructor() {
    addIcons({ homeOutline });
    // Enable/disable the menu on login page
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const isLogin = e.urlAfterRedirects.startsWith('/login');
        this.menu.enable(!isLogin, 'main');
      });

    // Restore theme preference
    const saved = localStorage.getItem('theme');
    this.dark = saved === 'dark';
    document.body.classList.toggle('dark', this.dark);
  }

  toggleDark(ev: any) {
    this.dark = ev.detail.checked;
    document.body.classList.toggle('dark', this.dark);
    localStorage.setItem('theme', this.dark ? 'dark' : 'light');
  }

  async doLogout() {
    if (this.busyLogout) return;
    this.busyLogout = true;
    try {
      await signOut(this.auth);
      this.confirmLogoutOpen = false;
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (err) {
      console.error('Logout failed:', err);
      // you could toast here if you like
    } finally {
      this.busyLogout = false;
    }
  }
  cancelLogout() {
    this.confirmLogoutOpen = false;
  }
  openConfirmLogout() {
    // optional: close the menu first for a cleaner look
    this.menu.close('main');
    this.confirmLogoutOpen = true;
  }
}
