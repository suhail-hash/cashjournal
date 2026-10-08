import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  Timestamp,
  serverTimestamp,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  collectionData, //OBSERVABLE
  doc,
  docData,
  writeBatch,
  getDocs,
} from '@angular/fire/firestore';
import { Storage, ref, deleteObject } from '@angular/fire/storage';
import { map, Observable } from 'rxjs';
import { Journal } from '../models/cash-journal.models';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private db = inject(Firestore);
  private storage = inject(Storage);

  private toJournal(d: any): Journal {
    return {
      id: d.id,
      description: d.description,
      period: d.period,
      openingBalance: Number(d.openingBalance || 0),
      status: d.status ?? 'open',
      owner: d.owner,
      access: d.access,
      updatedBy: d.updatedBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      createdBy: d.createdBy,
    };
  }

  //Observable for the Journals in general.
  journal$(jid: string): Observable<Journal> {
    const jRef = doc(this.db, 'journals', jid);
    return docData(jRef, { idField: 'id' }).pipe(
      map((d: any) => {
        if (!d) throw new Error('Journal not found');
        return this.toJournal(d);
      })
    );
  }

  //Observable for Journals that certain individuals with access can view
  listForUid$(uid: string): Observable<Journal[]> {
    const colRef = collection(this.db, 'journals');
    const appQuery = query(
      colRef,
      where('access', 'array-contains', uid),
      orderBy('period.from', 'asc')
    );
    return collectionData(appQuery, { idField: 'id' }).pipe(
      map((docs: any[]) => docs.map((d) => this.toJournal(d)))
    );
  }

  async createJournal(
    input: { description: string; from: string | Date; to: string | Date },
    actor: { uid: string; name: string }
  ): Promise<void> {
    const { description, from, to } = input;

    await addDoc(collection(this.db, 'journals'), {
      description,
      period: {
        from: Timestamp.fromDate(new Date(from)),
        to: Timestamp.fromDate(new Date(to)),
      },
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      owner: { uid: actor.uid, name: actor.name },
      access: [actor.uid],
      createdBy: { uid: actor.uid, name: actor.name },
      updatedBy: { uid: actor.uid, name: actor.name },
    });
  }

  async updateJournal(opts: {
    jid: string;
    patch: {
      description: string;
      from: string | Date;
      to: string | Date;
      status: 'open' | 'closed';
    };
    actor: { uid: string; name: string };
  }): Promise<void> {
    const { jid, patch, actor } = opts;
    //since new Date(string) can be Invalid Date
    const fromDate =
      typeof patch.from === 'string' ? new Date(patch.from) : patch.from;
    const toDate = typeof patch.to === 'string' ? new Date(patch.to) : patch.to;
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error('Invalid date(s) for period.');
    }
    await updateDoc(doc(this.db, 'journals', jid), {
      description: (patch.description || '').trim(),
      period: {
        from: Timestamp.fromDate(fromDate),
        to: Timestamp.fromDate(toDate),
      },
      status: patch.status,
      updatedAt: serverTimestamp(),
      updatedBy: { uid: actor.uid, name: actor.name },
    });
  }

  async deleteJournalDeep(opts: { jid: string }): Promise<void> {
    const { jid } = opts;

    // 1) read entries to collect attachment paths (BEFORE deleting docs)
    const entriesSnap = await getDocs(
      collection(this.db, `journals/${jid}/entries`)
    );
    const attachmentPaths = entriesSnap.docs
      .map((d) => (d.data() as any)?.attachment?.path as string | undefined)
      .filter((p): p is string => !!p);

    // 2) delete Storage blobs
    await Promise.all(
      attachmentPaths.map(
        (
          p //creates an array of Promises — one promise per deleteObject(...)
        ) =>
          deleteObject(ref(this.storage, p)).catch((e: any) => {
            // ignore if already gone; bubble other errors
            if (e?.code !== 'storage/object-not-found') throw e;
          })
      )
    );
    // 3) collect Firestore refs: entries -> invites -> journal
    const invitesSnap = await getDocs(
      query(collection(this.db, 'invites'), where('journalId', '==', jid))
    );

    const entryRefs = entriesSnap.docs.map((d) => d.ref);
    const inviteRefs = invitesSnap.docs.map((d) => d.ref);
    const journalRef = doc(this.db, `journals/${jid}`);
    const allRefs = [...entryRefs, ...inviteRefs, journalRef];
    //deletes all at once
    const batch = writeBatch(this.db);
    allRefs.forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

//Quellen:
//Option Object Pattern für UpdateJournals: https://medium.com/@bchadwickfrance/the-options-object-pattern-with-typescript-a14f33306ec8
//writebatch: https://firebase.google.com/docs/firestore/manage-data/transactions
//promise.all(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
