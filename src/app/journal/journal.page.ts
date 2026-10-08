import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { catchError, of, switchMap } from 'rxjs'; //OBSERVABLE
import { Journal } from '../models/cash-journal.models';
import { JournalService } from '../services/journal.service';
import { UsersService } from '../services/users.service';
import { InvitesService } from '../services/invites.service';
import { AuthService } from '../services/auth.service';
import { toDateValue as toDate, dateOrderValidator } from '../utils/cash-utils';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-journal',
  templateUrl: 'journal.page.html',
  styleUrls: ['journal.page.scss'],
  standalone: false,
})
export class JournalPage implements OnInit {
  private router = inject(Router);
  private invites = inject(InvitesService);
  private authSvc = inject(AuthService);
  private journalSvc = inject(JournalService);
  private users = inject(UsersService);
  private fb = inject(FormBuilder);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  private busyShare = false; // prevents double share clicks
  readonly toDateValue = toDate;

  uid$ = this.authSvc.uid$; //public observable for the template in html
  // state

  error?: string;

  // UI state
  showForm = false;
  showEdit = false;
  creating = false;
  savingEdit = false;
  editingId: string | null = null;

  // create form
  form = this.fb.group(
    {
      description: ['', [Validators.required, Validators.maxLength(120)]],
      from: ['', Validators.required],
      to: ['', Validators.required],
    },
    { validators: [dateOrderValidator('from', 'to')] }
  );

  // edit form
  editForm = this.fb.group(
    {
      description: ['', [Validators.required, Validators.maxLength(120)]],
      from: ['', Validators.required],
      to: ['', Validators.required],
      status: ['open' as 'open' | 'closed', Validators.required],
    },
    { validators: [dateOrderValidator('from', 'to')] }
  );

  openReport(j: Journal) {
    if (!j.id) return;
    this.router.navigate(['/journal', j.id, 'report'], {
      state: { journal: j },
    });
  }

  //MAP: verändert bestehendes obj, also aktueller stream bleibt bestehen und wird nur verändert
  // journals$!: Observable<Journal[]>;

  ngOnInit() {}

  //SWITCH-MAP: erstellt neues objekt bei veränderung, also bestehender stream wird abgebrochen stattdessen neuer stream gestartet
  journals$ = this.authSvc.uid$.pipe(
    switchMap((uid) => this.journalSvc.listForUid$(uid)),
    catchError((err) => {
      console.error('journals stream error', err);
      this.error = err?.message || String(err);
      return of([] as Journal[]);
    })
  );

  // -------- CRUD --------
  async create() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating = true;
    this.error = undefined;
    try {
      const uid = this.authSvc.uidOrThrow();
      const name = await this.users.displayNameFor(uid);
      const { description, from, to } = this.form.getRawValue();

      await this.journalSvc.createJournal(
        { description: description!, from: from!, to: to! },
        { uid: uid, name }
      );

      this.form.reset({ description: '', from: '', to: '' });
      this.showForm = false;
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.creating = false;
    }
  }

  openEdit(j: Journal) {
    this.editingId = j.id || null;
    this.editForm.setValue({
      description: j.description ?? '',
      from: this.toDateValue(j.period.from)?.toISOString() ?? '',
      to: this.toDateValue(j.period.to)?.toISOString() ?? '',
      status: j.status ?? 'open',
    });
    this.showEdit = true;
  }

  async saveEdit() {
    if (!this.editingId || this.editForm.invalid) return;
    this.savingEdit = true;
    this.error = undefined;
    try {
      const uid = this.authSvc.uidOrThrow();
      const name = await this.users.displayNameFor(uid);
      const { description, from, to, status } = this.editForm.getRawValue();

      await this.journalSvc.updateJournal({
        jid: this.editingId!,
        patch: {
          description: description!,
          from: from!,
          to: to!,
          status: status as 'open' | 'closed',
        },
        actor: { uid: uid, name },
      });
      this.showEdit = false;
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.savingEdit = false;
    }
  }

  // ===== Delete modal state =====
  confirmDeleteOpen = false;
  busyDelete = false;
  deleteTargetId?: string;
  deleteTargetDesc?: string;

  openConfirmDelete(j: Journal) {
    if (!j.id) return;
    this.deleteTargetId = j.id;
    this.deleteTargetDesc = j.description;
    this.confirmDeleteOpen = true;
  }
  cancelDelete() {
    if (this.busyDelete) return;
    this.confirmDeleteOpen = false;
    this.deleteTargetId = undefined;
    this.deleteTargetDesc = undefined;
  }

  async doDelete() {
    if (!this.deleteTargetId || this.busyDelete) return;
    this.busyDelete = true;
    try {
      await this.journalSvc.deleteJournalDeep({ jid: this.deleteTargetId });
      this.confirmDeleteOpen = false;

      (
        await this.toast.create({
          message: 'Journal gelöscht.',
          duration: 1500,
        })
      ).present();
    } catch (e: any) {
      (
        await this.toast.create({
          message: e?.message ?? String(e),
          duration: 2600,
          color: 'danger',
        })
      ).present();
    } finally {
      this.busyDelete = false;
      this.deleteTargetId = undefined;
      this.deleteTargetDesc = undefined;
    }
  }

  //Ist nur lang wegen Dialog.. das werde ich später ändern
  async share(j: Journal) {
    if (!j.id) return;
    if (this.busyShare) return;
    try {
      const ownerUid = this.authSvc.uidOrThrow();
      // only owner can share
      if (j.owner?.uid !== ownerUid) {
        (
          await this.toast.create({
            message: 'Only the owner can share this journal.',
            duration: 1800,
          })
        ).present();
        return;
      }
      // ask for email
      const alertEl = await this.alert.create({
        header: 'Share journal',
        inputs: [
          { name: 'email', type: 'email', placeholder: 'friend@example.com' },
        ],
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Send', role: 'confirm' },
        ],
      });
      await alertEl.present();
      const res = await alertEl.onDidDismiss();
      if (res.role !== 'confirm') return;

      this.busyShare = true;

      const email = (res.data?.values?.email || '').trim().toLowerCase();
      const result = await this.invites.sendInvite(j, ownerUid, email);

      switch (result) {
        case 'sent':
          (
            await this.toast.create({ message: 'Invite sent.', duration: 1600 })
          ).present();
          break;
        case 'not-found':
          (
            await this.toast.create({
              message: 'No user with that email.',
              duration: 2000,
              color: 'warning',
            })
          ).present();
          break;
        case 'self':
          (
            await this.toast.create({
              message: 'You cannot share with yourself.',
              duration: 2000,
            })
          ).present();
          break;
        case 'already-has-access':
          (
            await this.toast.create({
              message: 'User already has access.',
              duration: 1800,
            })
          ).present();
          break;
      }
    } catch (e: any) {
      // covers "not signed in" from uidOrThrow and other errors
      (
        await this.toast.create({
          message: e?.message ?? String(e),
          duration: 2400,
          color: 'danger',
        })
      ).present();
    } finally {
      this.busyShare = false;
    }
  }
}

/*Quellen:
Observable:
https://github.com/angular/angularfire/issues/3106
rxjs.dev/api/operators/switchMap
https://github.com/angular/angularfire/blob/main/docs/firestore.md
https://stackoverflow.com/questions/57770645/how-to-use-filter-with-switchmap
https://github.com/ngrx/platform/discussions/3607
Use filter to select values that meet a condition, allowing desired data to pass
through while discarding the rest. Use switchMap to handle asynchronous
operations by switching to a new observable (like an API call) for the latest source
value, cancelling previous ones. You would filter to decide which values proceed,
and switchMap to execute a new asynchronous task based on those filtered values

map = Wert transformieren (bleibt derselbe Stream).
switchMap = Neuen Stream starten aus dem Wert, alte abbrechen.
*/
