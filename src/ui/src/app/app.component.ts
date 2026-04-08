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

export interface IngredientsData {
  [key: string]: { name: string; thumbnail: string; fileId: string }[];
}

export interface MenuData {
  title: string;
  items: string[];
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
  aspectRatios: string[] = [
    '',
    '1:1',
    '3:2',
    '2:3',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
  ];
  selectedAspectRatio: string | null = this.aspectRatios[0];
  ingredientsData: IngredientsData = {};
  menus: MenuData[] = [];
  selectedIngredients: {
    [key: string]: { name: string; thumbnail: string; fileId: string } | null;
  } = {};

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
      .withSuccessHandler(
        (dropdowns: {
          variants: DropdownData;
          ingredients: IngredientsData;
          menus: MenuData[];
        }) => {
          this.zone.run(() => {
            this.dropdownsData = dropdowns.variants;
            this.ingredientsData = dropdowns.ingredients;
            this.menus = dropdowns.menus;

            // Prune selectedValues that are no longer valid
            for (const key in this.selectedValues) {
              if (!(key in this.dropdownsData)) {
                delete this.selectedValues[key];
              }
            }

            // Prune selectedIngredients that are no longer valid
            for (const key in this.selectedIngredients) {
              if (!(key in this.ingredientsData)) {
                delete this.selectedIngredients[key];
              }
            }

            this.isLoading = false;
          });
        }
      )
      .loadDropDowns();
  }

  setLoadingToFinished() {
    this.zone.run(() => {
      this.isLoading = false;
    });
  }

  generateSelected() {
    this.isLoading = true;
    console.log('selectedIngredients', this.selectedIngredients);
    console.log('generateAutomatically', {
      numberOfImages: this.numberOfImages,
      selectedValues: this.selectedValues,
    });
    const selectedIngredientIds: { [key: string]: string | null } = {};
    for (const key in this.selectedIngredients) {
      const ingredient = this.selectedIngredients[key];
      selectedIngredientIds[key] = ingredient ? ingredient.fileId : null;
    }
    google.script.run
      .withSuccessHandler(() => this.setLoadingToFinished())
      .generateImages(
        this.numberOfImages,
        this.selectedValues,
        this.autoScoreImages ? Number(this.scoringThreshold) : undefined,
        Number(this.maxRegenerations),
        this.selectedAspectRatio,
        selectedIngredientIds
      );
  }

  generateAutomatically() {
    console.log('generateAutomatically', {
      numberOfImages: this.numberOfImages,
    });
    const selectedIngredientIds: { [key: string]: string | null } = {};
    for (const key in this.selectedIngredients) {
      const ingredient = this.selectedIngredients[key];
      selectedIngredientIds[key] = ingredient ? ingredient.fileId : null;
    }
    this.isLoading = true;
    google.script.run
      .withSuccessHandler(() => this.setLoadingToFinished())
      .generateImages(
        this.numberOfImages,
        undefined,
        this.autoScoreImages ? Number(this.scoringThreshold) : undefined,
        Number(this.maxRegenerations),
        this.selectedAspectRatio,
        selectedIngredientIds
      );
  }
}
