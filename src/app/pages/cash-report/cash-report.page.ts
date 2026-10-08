import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Validators, NonNullableFormBuilder } from '@angular/forms';
import {
  toDateValue as toDate,
  computeRunningSaldo,
} from '../../utils/cash-utils';
import {
  Observable,
  combineLatest,
  map,
  catchError,
  of,
  shareReplay,
  firstValueFrom,
} from 'rxjs';
//models
import {
  Attachment,
  Entry,
  ReportJournal,
} from '../../models/cash-journal.models';
import type { EntryKind, EntryRow } from '../../models/cash-journal.models';
//services
import { PdfService } from '../../services/pdf.service';
import { JournalService } from '../../services/journal.service';
import { EntriesService } from '../../services/entries.service';
//fuer Kamera
import { PhotoService } from '../../services/photo.service';
//fuer PDF
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

@Component({
  selector: 'app-cash-report',
  templateUrl: './cash-report.page.html',
  styleUrls: ['./cash-report.page.scss'],
  standalone: false,
})
export class CashReportPage implements OnInit {
  // ──────────────────────────────────────────────────────────────────────────────
  // DI & template helpers
  // ──────────────────────────────────────────────────────────────────────────────
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);
  private pdf = inject(PdfService);
  private journals = inject(JournalService);
  private entriesSvc = inject(EntriesService);
  //private photoService = inject(PhotoService);

  /** Expose utility to template for safe Timestamp/Date rendering */
  readonly toDateValue = toDate; //makes this readable in the html

  // ──────────────────────────────────────────────────────────────────────────────
  // Public UI state (template uses these)
  // ──────────────────────────────────────────────────────────────────────────────
  jid = '';
  error: string | null = null;
  showForm = false;
  saving = false;

  /** File chosen in the ADD modal */
  selectedFile: File | null = null; //hält dateiname mit this.selectedFile.name

  // Edit modal state
  showEditEntry = false;
  savingEditEntry = false;
  private editingEntryId: string | null = null;
  editingEntryAttachment: Attachment | null = null;
  /** File chosen in the EDIT modal */
  editSelectedFile: File | null = null;
  /** If true during edit-save: remove current attachment (no replacement) */
  removeCurrentAttachment = false;

  // Delete confirm state
  confirmDeleteEntryOpen = false;
  busyDeleteEntry = false;
  private deleteEntryTargetId: string | null = null;

  // ──────────────────────────────────────────────────────────────────────────────
  // Streams
  // ──────────────────────────────────────────────────────────────────────────────
  journal$!: Observable<ReportJournal>;
  entries$!: Observable<Entry[]>;
  rows$!: Observable<EntryRow[]>;

  // ──────────────────────────────────────────────────────────────────────────────
  // Forms
  // ──────────────────────────────────────────────────────────────────────────────
  /** Factory to build both ADD and EDIT forms with identical shape */
  private createEntryForm() {
    return this.fb.group({
      date: this.fb.control<string>('', { validators: Validators.required }),
      description: this.fb.control<string>('', {
        validators: Validators.required,
      }),
      kind: this.fb.control<EntryKind>('debit', {
        validators: Validators.required,
      }),
      amount: this.fb.control<number>(0, {
        validators: [Validators.required, Validators.min(0.01)],
      }),
    });
  }
  /** ADD form */
  form = this.createEntryForm();
  /** EDIT form */
  editEntryForm = this.createEntryForm();

  // ──────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────────────────
  /** Reads jid, wires journal/entries streams, builds computed rows stream */
  ngOnInit() {
    this.jid = this.route.snapshot.paramMap.get('jid') || '';
    if (!this.jid) {
      this.router.navigateByUrl('/');
      return;
    }

    this.journal$ = this.journals.journal$(this.jid).pipe(shareReplay(1));
    // this.journal$ causes a single subscription to the source to be created
    // When the source emits the first Journal, shareReplay(1) stores that value and forwards it to the subscriber.
    // once all subscribers get the last emitted result in cache, sharereplay will store the next value to be shareds
    // pipe will take the output from the journal observable and forwards it into sharereplay

    this.entries$ = this.entriesSvc.entries$(this.jid).pipe(shareReplay(1));

    this.rows$ = combineLatest([this.journal$, this.entries$]).pipe(
      map(([j, entries]) =>
        computeRunningSaldo(entries, Number(j.openingBalance || 0))
      ),
      catchError((err) => {
        this.error = err?.message ?? String(err);
        return of([] as EntryRow[]);
      }),
      shareReplay(1)
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // File pickers (ADD + EDIT share the same handler)
  // ──────────────────────────────────────────────────────────────────────────────
  /** Handles file selection for add/edit modals; keeps “same file” reselect working */
  onFileSelected(ev: Event, target: 'add' | 'edit' = 'add') {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (target === 'add') {
      this.selectedFile = file; // remember it until form submit
    } else {
      this.editSelectedFile = file; // user picked a new file
      if (file) this.removeCurrentAttachment = false; // replacing, not removing
    }
    // allow picking the same file again to fire 'change'
    input.value = '';
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Edit flow
  // ──────────────────────────────────────────────────────────────────────────────
  /** Opens the EDIT modal and seeds the form from a row */
  openEditEntry(r: EntryRow) {
    this.error = null;

    if (!r.id) {
      this.error = 'Eintrag hat keine ID.';
      return;
    }
    this.editingEntryId = r.id;

    const kind: EntryKind = Number(r.debit || 0) > 0 ? 'debit' : 'credit';
    const amount =
      kind === 'debit' ? Number(r.debit || 0) : Number(r.credit || 0);

    this.editEntryForm.reset({
      date: toDate(r.date)?.toISOString() || '',
      description: r.description || '',
      kind,
      amount,
    });
    this.editEntryForm.markAsPristine();
    this.editEntryForm.markAsUntouched();

    this.editingEntryAttachment = r.attachment ?? null; // the current attachment on the entry
    this.editSelectedFile = null; // the new file if the attachment is replaced
    this.removeCurrentAttachment = false; // not removing by default
    this.showEditEntry = true; // open modal
  }

  /** Saves edits (fields + optional attachment add/replace/remove) */
  async saveEditEntry() {
    if (!this.editingEntryId || this.editEntryForm.invalid) return;
    this.savingEditEntry = true;
    this.error = null;

    const eid = this.editingEntryId;
    const { date, description, kind, amount } =
      this.editEntryForm.getRawValue();

    try {
      await this.entriesSvc.updateEntry(
        this.jid,
        eid,
        { date, description, kind, amount },
        {
          newFile: this.editSelectedFile, // picked during edit (or null)
          oldPath: this.editingEntryAttachment?.path ?? null, // Storage path of the old file
          removeAttachment: this.removeCurrentAttachment, // remove without replacement
        }
      );
      this.resetEditState();
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.savingEditEntry = false;
    }
  }

  /** Clears all edit modal state and closes it */
  private resetEditState(): void {
    this.showEditEntry = false;
    this.editingEntryId = null;
    this.editingEntryAttachment = null;
    this.editSelectedFile = null;
    this.removeCurrentAttachment = false;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Create flow
  // ──────────────────────────────────────────────────────────────────────────────
  /** Validates and creates a new entry, optionally with attachment */
  async addEntry() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { date, description, kind, amount } = this.form.getRawValue() as {
      date: string;
      description: string;
      kind: EntryKind;
      amount: number;
    };

    const val = Number(amount || 0);
    if (!isFinite(val) || val <= 0) {
      this.error = 'Bitte Betrag > 0 angeben.';
      return;
    }

    this.saving = true;
    this.error = null;

    try {
      await this.entriesSvc.addEntry(
        this.jid,
        { date, description, kind, amount: val },
        this.selectedFile
      );
      this.form.reset({ date: '', description: '', kind: 'debit', amount: 0 });
      this.selectedFile = null;
      this.showForm = false;
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.saving = false;
    }
  }
  // ──────────────────────────────────────────────────────────────────────────────
  // Delete flow
  // ──────────────────────────────────────────────────────────────────────────────
  /** Opens confirm dialog for deleting a specific row */
  openConfirmDeleteEntry(r: EntryRow) {
    this.deleteEntryTargetId = r.id || null;
    this.confirmDeleteEntryOpen = true;
  }

  /** Closes confirm dialog without deleting */
  cancelDeleteEntry() {
    if (this.busyDeleteEntry) return;
    this.confirmDeleteEntryOpen = false;
    this.deleteEntryTargetId = null;
  }

  /** Performs the delete (doc + attachment cleanup via service) */
  async doDeleteEntry() {
    if (!this.deleteEntryTargetId) return;
    this.busyDeleteEntry = true;
    this.error = null;

    try {
      await this.entriesSvc.deleteEntry(this.jid, this.deleteEntryTargetId);
      this.confirmDeleteEntryOpen = false;
      this.deleteEntryTargetId = null;
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    } finally {
      this.busyDeleteEntry = false;
    }
  }

  // Used by the ion-alert in the edit modal
  /** Buttons for “remove attachment” confirmation */
  public alertButtons = [
    { text: 'Abbrechen', role: 'cancel' },
    {
      text: 'Löschen',
      role: 'confirm',
      handler: () => {
        this.editSelectedFile = null;
        this.removeCurrentAttachment = true;
      },
    },
  ];

  // ──────────────────────────────────────────────────────────────────────────────
  // PDF
  // ──────────────────────────────────────────────────────────────────────────────
  /** Fetches latest data snapshot and delegates PDF export to PdfService */
  async generatePDF() {
    try {
      const [journal, rows] = await firstValueFrom(
        combineLatest([this.journal$, this.rows$])
      );
      const pdf = this.pdf.exportCashReport(journal, rows as EntryRow[]);

      const fileName = `Kassenbericht_${(
        journal.description || 'Report'
      ).replace(/\s+/g, '_')}.pdf`;
      const platform = Capacitor.getPlatform();

      if (platform === 'ios') {
        const dataUrl = pdf.output('datauristring');
        const base64 = dataUrl.split(',')[1];

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        const { uri } = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Documents,
        });

        // await Browser.open({ url: uri }); --> Das Capacitor Browser Plugin (Browser.open) ist nur für Web-URLs (http/https) gedacht.
        // Für lokale Dateien wie dein PDF funktioniert es auf iOS nicht → daher die Meldung "not implemented on iOS"

        await Share.share({
          title: 'Kassenbericht',
          url: uri, // <- das Filesystem-URI, z. B. file:///...
          dialogTitle: 'PDF teilen oder öffnen mit...',
        });
      } else {
        pdf.save(fileName);
      }
      this.pdf.exportCashReport(journal, rows as EntryRow[]);
    } catch (e: any) {
      this.error = e?.message ?? String(e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Camera
  // ──────────────────────────────────────────────────────────────────────────────

  //fuer kamera
  // Das ist eine Contructor injection.. wir wollen unser code standard machen indem wir nur Dependency injections nutzen
  //constructor(public photoService: PhotoService) {}
  private photoService = inject(PhotoService);
  public currentPhoto?: string;

  async addPhotoToGallery() {
    console.log('es wird in die methode reingegenagen');
    try {
      //leitet weiter an service
      const photo = await this.photoService.addNewToGallery();
      console.log('Foto aufgenommen:', photo);
      //this.photoService.addNewToGallery(); --> Versuch ohne aufgenommenes bild anzeigen
    } catch (err) {
      console.error(
        'Kamera konnte nicht geöffnet werden, siehe addPhotoToGallery-Methode',
        err
      );
    }
  }
}

/*
Quellen
farben: https://color.adobe.com/de/create/color-wheel
Sharereplay: https://www.learnrxjs.io/learn-rxjs/operators/multicasting/sharereplay
alertbutton: https://ionicframework.com/docs/api/alert
pipe: https://rxjs.dev/api/index/function/pipe
*/
