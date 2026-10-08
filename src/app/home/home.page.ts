import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../services/users.service';
import { InvitesService } from '../services/invites.service';
import { of, from, Subscription } from 'rxjs';
import { switchMap, catchError, map, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  private authSvc = inject(AuthService);
  private users = inject(UsersService);
  private invites = inject(InvitesService);

  // state for the mini profile editor
  firstName = '';
  lastName = '';
  displayName = '';
  profileLoaded = false;
  needsName = false;
  error?: string;

  // show a badge with pending invite count
  pendingCount$ = this.authSvc.uid$.pipe(
    switchMap((uid) => this.invites.listPendingForUid$(uid)),
    map((list) => list.length),
    catchError(() => of(0)),
    shareReplay(1)
  );

  private sub?: Subscription;
  ngOnInit() {
    this.sub = this.authSvc.uid$
      .pipe(
        switchMap((uid) => (uid ? from(this.users.getProfile(uid)) : of(null))),
        catchError((err) => {
          this.error = err?.message ?? String(err);
          return of(null);
        })
      )
      .subscribe((p) => {
        if (!p) {
          this.firstName = '';
          this.lastName = '';
          this.displayName = '';
          this.needsName = false;
          this.profileLoaded = true;
          return;
        }
        this.firstName = p.firstName ?? '';
        this.lastName = p.lastName ?? '';
        this.displayName =
          p.displayName ||
          [this.firstName, this.lastName].filter(Boolean).join(' ');
        this.needsName = !(this.firstName || this.lastName);
        this.profileLoaded = true;
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
//Quellen: https://rxjs.dev/api/operators/switchMap
