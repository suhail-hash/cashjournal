import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { JournalPage } from './journal.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { JournalPageRoutingModule } from './journal-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ExploreContainerComponentModule,
    JournalPageRoutingModule
  ],
  declarations: [JournalPage]
})
export class journalPageModule {}
