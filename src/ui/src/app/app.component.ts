/**
 * Copyright 2026 Google LLC
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
import {CommonModule} from '@angular/common';
import {Component, NgZone, OnInit} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';

/** Global reference to the Google Apps Script `google.script.run` API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

/**
 * Represents the dictionary mapping dropdown names to their string option
 * arrays.
 */
export interface DropdownData {
  [key: string]: string[];
}

/** Represents the details of product/ingredient assets. */
export interface IngredientItem {
  name: string;
  thumbnail: string;
  fileId: string;
}

/**
 * Represents the dictionary mapping category names to list of ingredients.
 */
export interface IngredientsData {
  [key: string]: IngredientItem[];
}

/** Represents structural data for category card containers in the UI. */
export interface MenuData {
  title: string;
  items: string[];
}

/**
 * Main root component for the BackgroundR Angular Web Application.
 * Exposes settings and trigger actions to generate and score background
 * images using Gemini.
 */
@Component({
    selector: 'app-root',
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
        MatTooltipModule,
        MatSlideToggleModule,
    ],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  /** Indicates whether a backend operation is running. */
  protected isLoading = false;

  /**
   * The current progress percentage (0-100) when running long batch
   * generation tasks.
   */
  protected loadingProgress: number | undefined;

  /** Available variant options grouped by category. */
  protected dropdownsData: DropdownData = { 'Loading...': [] };

  /** The target number of images to generate per batch. */
  protected numberOfImages = 1;

  /** Map storing selected values for custom dropdown categories. */
  protected selectedValues: { [key: string]: string | null } = {};

  /**
   * Controls whether automatically generated images will be evaluated by
   * Gemini.
   */
  protected autoScoreImages = false;

  /**
   * The minimum acceptable score for generated images under automatic
   * quality control.
   */
  protected scoringThreshold = 5;

  /** The maximum number of times a low-score image may be regenerated. */
  protected maxRegenerations = 1;

  /** The list of predefined aspect ratios available for image generation. */
  protected aspectRatios: string[] = [
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

  /** The currently selected aspect ratio. */
  protected selectedAspectRatio: string | null = this.aspectRatios[0];

  /** Available ingredient asset options grouped by category. */
  protected ingredientsData: IngredientsData = {};

  /** Categorized UI menus defined by sheet layouts. */
  protected menus: MenuData[] = [];

  /** Map storing the selected ingredient items by category. */
  protected selectedIngredients: {
    [key: string]: IngredientItem | null;
  } = {};

  constructor(private readonly zone: NgZone) {}

  /**
   * Angular Lifecycle hook invoked after component initialization.
   * Triggers initial retrieval of dropdown options from the backend
   * spreadsheet.
   */
  ngOnInit(): void {
    this.loadDropDowns();
  }

  /**
   * Handler invoked when a dropdown value changes.
   *
   * @param dropdownName The identifier of the modified dropdown category.
   * @param selectedValue The newly selected string value.
   * @returns A boolean representing update acknowledgement.
   */
  protected onDropdownChange(
    dropdownName: string,
    selectedValue: string
  ): boolean {
    this.selectedValues[dropdownName] = selectedValue;
    return true;
  }

  /**
   * Fetches the full catalog of dropdowns, ingredients, and menus from
   * Google Sheets, then automatically prunes stale selections.
   */
  protected loadDropDowns(): void {
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

  /**
   * Helper callback to finalize loading status and hide progress bars.
   */
  protected setLoadingToFinished(): void {
    this.zone.run(() => {
      this.isLoading = false;
    });
  }

  /**
   * Requests the Google Apps Script backend to generate images utilizing the
   * explicit user selections configured in the sidebar dropdowns.
   */
  protected generateSelected(): void {
    this.isLoading = true;
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

  /**
   * Requests the Google Apps Script backend to generate images automatically
   * based on global config without using explicit custom selections.
   */
  protected generateAutomatically(): void {
    const selectedIngredientIds: { [key: string]: string | null } = {};
    for (const [key, ingredient] of Object.entries(this.selectedIngredients)) {
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
