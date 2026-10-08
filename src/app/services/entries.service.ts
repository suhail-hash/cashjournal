import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { Observable, map } from 'rxjs';
import { Attachment, Entry } from '../models/cash-journal.models';
import {
  toFirestoreTimestamp,
  guessContentType,
  isAllowedAttachmentType,
  buildAttachmentPath,
} from '../utils/cash-utils';

@Injectable({ providedIn: 'root' })
export class EntriesService {
  private db = inject(Firestore);
  private storage = inject(Storage);

  //Observable
  entries$(jid: string): Observable<Entry[]> {
    const entCol = collection(this.db, `journals/${jid}/entries`); //Builds a reference to the subcollection journals/<jid>/entries.
    const qy = query(
      entCol,
      orderBy('date', 'asc'),
      orderBy('createdAt', 'asc')
    ); //Creates a Firestore query that sorts the docs by date ascending, and uses createdAt to avoid ties
    return collectionData<any>(qy, { idField: 'id' }); //returns the collection of entries and writes id to firebase
  }

  /** Add a new entry; optionally upload a file and patch attachment. */
  async addEntry(
    jid: string,
    form: {
      date: string | Date;
      description: string;
      kind: 'debit' | 'credit';
      amount: number;
    },
    file?: File | null
  ): Promise<void> {
    const entCol = collection(this.db, `journals/${jid}/entries`);
    const newRef = doc(entCol);

    // Base create
    await setDoc(newRef, {
      date: toFirestoreTimestamp(form.date),
      description: (form.description || '').trim(),
      debit: form.kind === 'debit' ? Number(form.amount || 0) : 0,
      credit: form.kind === 'credit' ? Number(form.amount || 0) : 0,
      attachment: null,
      createdAt: serverTimestamp(),
    });

    try {
      if (file) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error('Datei größer als 10MB (Limit 10MB).');
        const contentType = guessContentType(file);
        if (!isAllowedAttachmentType(contentType))
          throw new Error('Nur Bilder oder PDF sind erlaubt.');

        const objectPath = buildAttachmentPath(jid, newRef.id, file.name); // -> journals/<jid>/entries/<eid>/attachments/<timestamp>_<safe-name>
        const sref = ref(this.storage, objectPath);
        await uploadBytes(sref, file, { contentType }); //Upload to storage
        const url = await getDownloadURL(sref); //Get a download URL to display in the table later

        await updateDoc(newRef, {
          attachment: {
            url, //what the user needs to open the file.
            path: objectPath, //what the user needs to delete or replace the file later
            name: file.name,
            type: contentType,
            size: file.size ?? null,
          },
        });
      }
    } catch (e) {
      // rollback the created entry if upload/patch failed
      try {
        await deleteDoc(newRef);
      } catch {}
      throw e;
    }
  }

  /** Update entry fields and manage attachment replace/remove/no-change. */
  async updateEntry(
    jid: string,
    eid: string,
    base: {
      date: string | Date;
      description: string;
      kind: 'debit' | 'credit';
      amount: number;
    },
    opts: {
      newFile?: File | null;
      oldPath?: string | null;
      removeAttachment?: boolean;
    } = {}
  ): Promise<void> {
    const entryRef = doc(this.db, `journals/${jid}/entries/${eid}`);

    const updates: any = {
      date: toFirestoreTimestamp(base.date),
      description: (base.description || '').trim(),
      debit: base.kind === 'debit' ? Number(base.amount || 0) : 0,
      credit: base.kind === 'credit' ? Number(base.amount || 0) : 0,
    };

    const hadOld = !!opts.oldPath; //strict boolean: If opts.oldPath is a non-empty string like "journals/…/x.pdf" → hadOld === true
    const oldPath = opts.oldPath ?? null; //nullish coalescing: keeps the value unless it’s null. pass into ref(storage, oldPath) when delete.

    // Replace with a new file
    if (opts.newFile) {
      const file = opts.newFile;
      if (file.size > 10 * 1024 * 1024)
        throw new Error('Datei größer als 10MB (Limit 10MB).');
      const contentType = guessContentType(file);
      if (!isAllowedAttachmentType(contentType))
        throw new Error('Nur Bilder oder PDF sind erlaubt.');

      const objectPath = buildAttachmentPath(jid, eid, file.name);
      const sref = ref(this.storage, objectPath);
      await uploadBytes(sref, file, { contentType }); // upload new file to Storage
      const url = await getDownloadURL(sref);

      updates.attachment = {
        // build the new attachment object for the db
        url,
        path: objectPath,
        name: file.name,
        type: contentType,
        size: file.size ?? null,
      };

      await updateDoc(entryRef, updates); // write updates + new attachment object

      if (hadOld && oldPath) {
        //used together to decide if deletion is needed and have the thing to delete
        try {
          await deleteObject(ref(this.storage, oldPath));
        } catch (e: any) {
          //delete the old file
          if (!(e?.code === 'storage/object-not-found')) throw e;
        }
      }
      return;
    }

    // Remove existing file
    if (opts.removeAttachment && hadOld && oldPath) {
      await updateDoc(entryRef, { ...updates, attachment: null }); //set the attachment object to null
      try {
        await deleteObject(ref(this.storage, oldPath)); //use the oldpath to find the file in storage and delete it
      } catch (e: any) {
        if (!(e?.code === 'storage/object-not-found')) throw e;
      }
      return;
    }

    // No file change
    await updateDoc(entryRef, updates);
  }

  /** Delete entry and attached blob (if any). */
  async deleteEntry(jid: string, eid: string): Promise<void> {
    const entryRef = doc(this.db, `journals/${jid}/entries/${eid}`);
    const snap = await getDoc(entryRef);
    const data = snap.exists() ? (snap.data() as any) : null;
    const path: string | undefined = data?.attachment?.path;

    if (path) {
      try {
        await deleteObject(ref(this.storage, path));
      } catch (e: any) {
        if (!(e?.code === 'storage/object-not-found')) throw e;
      }
    }

    await deleteDoc(entryRef);
  }
}
//Quellen:
//Firebase upload file and building path https://firebase.google.com/docs/storage/web/upload-files#web
//strict boolean: https://typescript-eslint.io/rules/strict-boolean-expressions/
//CollectionData: https://egghead.io/lessons/firebase-fetch-a-list-of-firebase-documents-with-firestore-collectiondata
//
