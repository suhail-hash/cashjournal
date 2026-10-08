import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private authSvc = inject(AuthService);
  private users = inject(UsersService);
  showPw = false;
  busy = false;
  error?: string;
  isRegister = false; // toggle Sign in <-> Register

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    firstName: [''], // required only when registering
    lastName: [''], // required only when registering
  });

  // ----- email/password flows -----
  async submitEmailForm() {
    this.error = undefined;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, firstName, lastName } = this.form.getRawValue();
    this.busy = true;
    try {
      if (this.isRegister) {
        await this.authSvc.registerWithEmail({
          // opts pattern
          email: email!,
          password: password!,
          firstName: firstName ?? '',
          lastName: lastName ?? '',
        });
      } else {
        await this.authSvc.signInWithEmail(email!, password!);
        console.log('ist drin, supi');
      }
      console.log('jetzt sollte man zur home weitergeleitet werden');
      await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
    } catch (e: any) {
      console.log('hier ist ein fehler', e?.code, e?.message, e);
      this.error = e?.message ?? String(e);
    } finally {
      console.log('was nicht was fuer ein case das sein soll');
      this.busy = false;
    }
  }

  async sendReset() {
    this.error = undefined;
    const email = this.form.controls.email.value;
    if (!email) {
      this.error = 'Bitte E-Mail eingeben.';
      return;
    }
    this.busy = true;
    try {
      await this.authSvc.sendReset(email);
      alert('Reset-Link gesendet. Bitte E-Mail prüfen.');
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.busy = false;
    }
  }

  toggleMode() {
    this.isRegister = !this.isRegister;
    const first = this.form.controls.firstName;
    const last = this.form.controls.lastName;
    if (this.isRegister) {
      first.addValidators([Validators.required]);
      last.addValidators([Validators.required]);
    } else {
      first.removeValidators([Validators.required]);
      last.removeValidators([Validators.required]);
      first.setValue('');
      last.setValue('');
    }
    first.updateValueAndValidity();
    last.updateValueAndValidity();
  }
}

//Quelle:
//Issue mit Ios und await bei auth: https://github.com/firebase/firebase-js-sdk/issues/1881#issuecomment-501886866
//In Firebase Web v9+, when you initialize Auth you can choose where the user’s session is stored
//https://firebase.google.com/docs/auth/web/custom-dependencies
