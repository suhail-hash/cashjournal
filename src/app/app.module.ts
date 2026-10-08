import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth} from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { getApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
} from 'firebase/auth';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    //Hier findet die initialisierung statt
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)), // Binded the DB using the keys in environments/environment.ts
    provideAuth(() =>
      initializeAuth(getApp(), {
        persistence: [
          indexedDBLocalPersistence, //stores the session in IndexedDB. Persists across reloads
        ],
      })
    ),
    provideFirestore(() => getFirestore()), // The Database
    provideStorage(() => getStorage()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}


//Quellen:
//browserPopupRedirectResolver:    https://firebase.google.com/docs/auth/web/custom-dependencies    HAT NICHT GEKLAPPT
