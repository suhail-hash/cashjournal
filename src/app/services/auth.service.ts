import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
  authState,
} from '@angular/fire/auth';
import { setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { map, filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private db = inject(Firestore);
  readonly user$ = authState(this.auth);

  readonly uid$ = this.user$.pipe(
    map((u) => u?.uid ?? null),
    filter((uid): uid is string => !!uid)
  );

  async registerWithEmail(opts: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    const cred = await createUserWithEmailAndPassword(
      this.auth,
      opts.email,
      opts.password
    );

    const displayName = [opts.firstName?.trim(), opts.lastName?.trim()]
      .filter(Boolean)
      .join(' ');
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    await setDoc(
      doc(this.db, `users/${cred.user.uid}`),
      {
        firstName: opts.firstName?.trim() ?? '',
        lastName: opts.lastName?.trim() ?? '',
        displayName,
        email: opts.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /** True if the user has the email/password provider linked. */
  // Keep the iOS fix: set IndexedDB persistence before email login
  async signInWithEmail(email: string, password: string): Promise<void> {
    await setPersistence(this.auth, indexedDBLocalPersistence);
    console.log('häne bei der setpersistence wgg await kaka');
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  isPasswordUser(u: User | null): boolean {
    return !!u?.providerData?.some((p) => p.providerId === 'password');
  }

  /** Reauth with current password, then set a new one. */
  async changePasswordWithReauth(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const u = this.auth.currentUser;
    if (!u?.email) throw new Error('No email user signed in.');
    const cred = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, cred);
    await updatePassword(u, newPassword);
  }

  async sendReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  /** Send reset email to the currently signed in user. */
  async sendResetToCurrent(): Promise<void> {
    const u = this.auth.currentUser;
    if (!u?.email) throw new Error('No email on account.');
    await sendPasswordResetEmail(this.auth, u.email);
  }

  currentUser(): User | null {
    return this.auth.currentUser;
  }

  uidOrThrow(): string {
    const u = this.auth.currentUser;
    if (!u) throw new Error('Not signed in');
    return u.uid;
  }
}

//Quellen:
//Option Object Pattern für Registration: https://medium.com/@bchadwickfrance/the-options-object-pattern-with-typescript-a14f33306ec8
//firebase signin: https://firebase.google.com/docs/auth/web/password-auth
