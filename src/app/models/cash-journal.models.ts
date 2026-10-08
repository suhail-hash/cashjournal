import { Timestamp } from '@angular/fire/firestore';

export type Attachment = {
  url: string;
  path?: string | null;
  name?: string | null;
  type?: string | null;
  size?: number | null;
};
export type EntryKind = 'debit' | 'credit';

export interface Entry {
  id?: string;
  date: Timestamp | Date;
  description?: string;
  debit?: number;
  credit?: number;

  // Support both shapes for now (as in your component)
  attachment?: Attachment | null;
  attachmentUrl?: string | null;

  // Keep this loose unless you want to import Firestore FieldValue
  createdAt?: unknown;
}
export type EntryRow = Entry & { saldo: number };

export interface Journal {
  id: string;
  description: string;
  period: { from: Timestamp | Date; to: Timestamp | Date };
  openingBalance?: number;
  status?: 'open' | 'closed';
  owner?: { uid: string; name?: string };
  access?: string[];
  updatedBy?: { uid: string | null; name?: string | null };
  createdAt?: any;
  updatedAt?: any;
  createdBy?: { uid: string; name?: string | null };
}

//subset of Journal interface for Cashreports
export type ReportJournal = Pick<
  Journal,
  'id' | 'description' | 'period' | 'openingBalance'
>; //Pick is what’s known as a Mapped Type

//Quellen :
// Pick type:  https://ultimatecourses.com/blog/using-typescript-pick-mapped-type
