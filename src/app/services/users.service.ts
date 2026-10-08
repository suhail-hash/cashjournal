import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import {
  UserCredential,
  getAdditionalUserInfo,
  updateProfile,
} from '@angular/fire/auth';

export interface UserProfile {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  createdAt?: any;
  updatedAt?: any;
}
export interface MinimalUser {
  uid: string;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private db = inject(Firestore);

  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(this.db, `users/${uid}`));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async displayNameFor(uid: string): Promise<string> {
    const p = await this.getProfile(uid);
    return p?.displayName || 'Unbekannt';
  }

  async updateProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
    await setDoc(
      doc(this.db, `users/${uid}`),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  /**
   * Looks up a user by email (case-insensitive via trim+lower).
   * Returns { uid, displayName? } or null if not found.
   */
  async findByEmailLower(emailRaw: string): Promise<MinimalUser | null> {
    const email = (emailRaw || '').trim().toLowerCase();
    if (!email) return null;

    const usersCol = collection(this.db, 'users');

    // If you later store "emailLower", prefer that field:
    // const qs = await getDocs(query(usersCol, where('emailLower', '==', email)));

    const qs = await getDocs(query(usersCol, where('email', '==', email)));
    if (qs.empty) return null;

    const d = qs.docs[0];
    const data = d.data() as any;
    return { uid: d.id, displayName: data?.displayName };
  }

  async ensureProfileFromCredential(cred: UserCredential): Promise<void> {
    const u = cred.user;
    const uid = u.uid;

    const existing =
      ((await getDoc(doc(this.db, `users/${uid}`))).data() as any) || {};
    let firstName = existing.firstName || '';
    let lastName = existing.lastName || '';
    let displayName = existing.displayName || '';

    const info = getAdditionalUserInfo(cred);
    if (info?.providerId === 'google.com') {
      const profile: any = info.profile || {};
      const given = profile?.given_name;
      const family = profile?.family_name;
      if (!firstName && given) firstName = given;
      if (!lastName && family) lastName = family;
      if (!displayName && (given || family)) {
        displayName = [given, family].filter(Boolean).join(' ');
      }
    }

    if (!displayName && u.displayName) displayName = u.displayName!;

    await setDoc(
      doc(this.db, `users/${uid}`),
      {
        email: u.email ?? existing.email ?? null,
        firstName,
        lastName,
        displayName,
        createdAt: existing.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    //reflect displayName back into Auth if it was empty
    if (!u.displayName && displayName) {
      await updateProfile(u, { displayName });
    }
  }
}
