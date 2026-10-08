import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  collectionData,
  arrayUnion,
} from '@angular/fire/firestore';
import { UsersService } from './users.service';
import { Journal } from '../models/cash-journal.models';
import { Observable } from 'rxjs';
import { Invite, InviteResult } from '../models/invites.models';

@Injectable({ providedIn: 'root' })
export class InvitesService {
  private db = inject(Firestore);
  private users = inject(UsersService);

  listPendingForUid$(uid: string): Observable<Array<Invite & { id: string }>> {
    const qy = query(
      collection(this.db, 'invites'),
      where('inviteeUid', '==', uid),
      where('status', '==', 'pending')
    );
    return collectionData(qy, { idField: 'id' }) as Observable< //emaits an array of the invites to be shown to all subscribers
      Array<Invite & { id: string }>
    >;
  }

  /**
   * Creates an invite for a journal.
   * Returns a small result code for the UI to decide which toast to show.
   */
  async sendInvite(
    journal: Journal,
    ownerUid: string,
    inviteeEmailRaw: string
  ): Promise<InviteResult> {
    const email = (inviteeEmailRaw || '').trim().toLowerCase();
    if (!email) throw new Error('Email required');
    if (!journal.id) throw new Error('Journal has no id');

    // Lookup invitee by email
    const found = await this.users.findByEmailLower(email);
    if (!found) return 'not-found';
    if (found.uid === ownerUid) return 'self';

    // Already has access?
    const has =
      Array.isArray(journal.access) && journal.access.includes(found.uid);
    if (has) return 'already-has-access';

    // Owner display name (for invite record)
    const ownerName = await this.users.displayNameFor(ownerUid);

    // Deterministic invite id: {journalId}_{inviteeUid}
    const iid = `${journal.id}_${found.uid}`;
    await setDoc(
      doc(this.db, 'invites', iid),
      {
        journalId: journal.id,
        journalDesc: journal.description,
        ownerUid,
        ownerName,
        inviteeUid: found.uid,
        inviteeEmail: email,
        status: 'pending',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return 'sent';
  }

  async acceptInvite(
    inviteId: string,
    journalId: string,
    uid: string
  ): Promise<void> {
    // 1) mark invite accepted
    await updateDoc(doc(this.db, 'invites', inviteId), { status: 'accepted' });
    // 2) add user to journal access
    await updateDoc(doc(this.db, 'journals', journalId), {
      access: arrayUnion(uid),
    });
  }

  async declineInvite(inviteId: string): Promise<void> {
    await updateDoc(doc(this.db, 'invites', inviteId), { status: 'declined' });
  }
}

//Quellen:
//arrayunion: https://firebase.google.com/docs/firestore/manage-data/add-data
