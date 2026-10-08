import { Component, OnInit, inject } from '@angular/core';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private users = inject(UsersService);
  private authSvc = inject(AuthService);

  loading = true;
  error?: string;
  isPasswordUser = false;
  email = '';

  profileForm = this.fb.group({
    firstName: ['', [Validators.maxLength(60)]],
    lastName: ['', [Validators.maxLength(60)]],
  });


  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', Validators.required],
  });

  // state for the mini profile editor
  firstName = '';
  lastName = '';
  displayName = '';
  profileLoaded = false; // stops flicker until we know
  needsName = false; // controls visibility of the form

  async ngOnInit() {
    const u = this.authSvc.currentUser();
    if (!u) {
      this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }
    this.email = u.email || '';
    //u.providerData is an array of linked identity providers on the current Firebase user
    this.isPasswordUser = this.authSvc.isPasswordUser(u);
    const p = (await this.users.getProfile(u.uid)) || {};
    this.profileForm.patchValue({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
    });
    this.loading = false;
  }

  async saveProfile() {
    this.error = undefined;
    const uid = this.authSvc.uidOrThrow();
    if (!uid) return;

    try {
      const uid = this.authSvc.uidOrThrow(); // <- no direct Auth usage
      const { firstName, lastName } = this.profileForm.getRawValue();
      const first = (firstName || '').trim();
      const last = (lastName || '').trim();
      const displayName = [first, last].filter(Boolean).join(' ');

      await this.users.updateProfile(uid, {
        firstName: first || null,
        lastName: last || null,
        displayName,
      });

      alert('Profile updated');
      this.displayName = displayName;
      this.needsName = false;
    } catch (e: any) {
      if (
        String(e?.message || e)
          .toLowerCase()
          .includes('not signed in')
      ) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      console.error(e);
      this.error = e?.message ?? String(e);
    }
  }

  async changePassword() {
    this.error = undefined;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword, confirm } = this.passwordForm.value;
    if (newPassword !== confirm) {
      this.error = 'Passwords do not match.';
      return;
    }

    try {
      await this.authSvc.changePasswordWithReauth(
        currentPassword!,
        newPassword!
      );
      this.passwordForm.reset();
      alert('Password updated.');
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    }
  }

  async sendReset() {
    try {
      await this.authSvc.sendResetToCurrent();
      alert('Reset link sent.');
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    }
  }
}
