import { Component, OnInit, inject } from '@angular/core';
import { Observable, of, switchMap, catchError, shareReplay } from 'rxjs';
import { Invite } from 'src/app/models/invites.models';
import { InvitesService } from '../../services/invites.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.page.html',
  styleUrls: ['./requests.page.scss'],
  standalone: false,
})
export class RequestsPage implements OnInit {
  private invites = inject(InvitesService);
  private authSvc = inject(AuthService);

  invites$!: Observable<Array<Invite & { id: string }>>;
  loaded = false;
  error?: string;
  busyId?: string;

  ngOnInit() {
    // Initialize the observable of pending invites for the current user
    this.invites$ = this.authSvc.uid$.pipe(
      switchMap((uid) => this.invites.listPendingForUid$(uid)),
      catchError((err) => {
        this.error = err?.message ?? String(err);
        return of([] as Array<Invite & { id: string }>);
      }),
      shareReplay(1)
    );
  }

  async accept(inv: Invite & { id: string }) {
    // Prevent multiple simultaneous actions
    if (this.busyId) return;
    this.busyId = inv.id;
    try {
      // Get uid
      const uid = this.authSvc.uidOrThrow();
      await this.invites.acceptInvite(inv.id, inv.journalId, uid);
      alert('Added. You now have access.');
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      this.busyId = undefined;
    }
  }

  async decline(inv: Invite & { id: string }) {
    if (this.busyId) return;
    this.busyId = inv.id;
    try {
      await this.invites.declineInvite(inv.id);
    } finally {
      this.busyId = undefined;
    }
  }
}
