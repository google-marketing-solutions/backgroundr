/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

export interface DropdownData {
  [key: string]: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatCardModule,
    MatProgressBarModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    BrowserAnimationsModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoading = false;
  loadingProgress: number | undefined;
  dropdownsData: DropdownData = { 'Loading...': [] };
  numberOfImages = 1;
  selectedValues: { [key: string]: string | null } = {};
  autoScoreImages = false;
  scoringThreshold = 5;
  maxRegenerations = 1;

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    this.loadDropDowns();
  }

  onDropdownChange(dropdownName: string, selectedValue: string) {
    this.selectedValues[dropdownName] = selectedValue;
    return true;
  }

  loadDropDowns() {
    this.isLoading = true;
    google.script.run
      .withSuccessHandler((dropdowns: DropdownData) => {
        this.zone.run(() => {
          this.dropdownsData = dropdowns;
          console.log('dropdownsData', this.dropdownsData);
          this.isLoading = false;
        });
      })
      .loadDropDowns();
  }

  setLoadingToFinished() {
    this.zone.run(() => {
      this.isLoading = false;
    });
  }

  generateSelected() {
    this.isLoading = true;
    console.log('generateAutomatically', {
      numberOfImages: this.numberOfImages,
      selectedValues: this.selectedValues,
    });
    google.script.run
      .withSuccessHandler(() => this.setLoadingToFinished())
      .generateImages(
        this.numberOfImages,
        this.selectedValues,
        this.autoScoreImages ? this.scoringThreshold : undefined,
        this.maxRegenerations
      );
  }

  generateAutomatically() {
    console.log('generateAutomatically', {
      numberOfImages: this.numberOfImages,
    });
    this.isLoading = true;
    google.script.run
      .withSuccessHandler(() => this.setLoadingToFinished())
      .generateImages(
        this.numberOfImages,
        undefined,
        this.autoScoreImages ? Number(this.scoringThreshold) : undefined,
        Number(this.maxRegenerations)
      );
  }
}
