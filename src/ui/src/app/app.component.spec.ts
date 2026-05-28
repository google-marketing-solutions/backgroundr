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
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AppComponent', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = {
      script: {
        run: {
          withSuccessHandler: () => ({
            loadDropDowns: () => {},
            generateImages: () => {},
          }),
        },
      },
    };

    TestBed.configureTestingModule({
      imports: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).overrideComponent(AppComponent, {
      set: { imports: [CommonModule], schemas: [NO_ERRORS_SCHEMA] },
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should remove stale options when loading new dropdowns', () => {
    // Setup initial state with some selections
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.selectedValues = { OldDropdown: 'OldValue' };
    app.selectedIngredients = {
      OldIngredient: { name: 'Old', thumbnail: '', fileId: '1' },
    };

    // Mock google.script.run
    const mockGoogle = {
      script: {
        run: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          withSuccessHandler: (callback: any) => ({
            loadDropDowns: () => {
              // Simulate returning new data that does NOT have the old keys
              callback({
                variants: { NewDropdown: ['NewValue'] },
                ingredients: {
                  NewIngredient: [{ name: 'New', thumbnail: '', fileId: '2' }],
                },
              });
            },
          }),
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = mockGoogle;

    // Act
    app.loadDropDowns();

    // Assert
    // WITH BUG: OldDropdown and OldIngredient should still be present
    // WITH FIX: They should be gone

    // We expect this to FAIL before the fix
    expect(app.selectedValues['OldDropdown']).toBeUndefined();
    expect(app.selectedIngredients['OldIngredient']).toBeUndefined();
    expect(app.dropdownsData['NewDropdown']).toBeDefined();
    expect(app.dropdownsData['NewDropdown']).toBeDefined();
  });

  it('should ensure maxRegenerations and scoringThreshold are numbers when calling generateSelected', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Simulate string inputs (e.g. from template binding before type coercion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.maxRegenerations = '5' as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.scoringThreshold = '8' as any;
    app.autoScoreImages = true;

    // Spy on google.script.run.generateImages
    const generateImagesSpy = jasmine.createSpy('generateImages');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = {
      script: {
        run: {
          withSuccessHandler: () => ({
            generateImages: generateImagesSpy,
          }),
        },
      },
    };

    // Act
    app.generateSelected();

    // Assert
    expect(generateImagesSpy).toHaveBeenCalled();
    const args = generateImagesSpy.calls.mostRecent().args;
    // args structure: (numberOfImages, selectedValues, scoringThreshold, maxRegenerations, ...)
    // Index 2 is scoringThreshold, Index 3 is maxRegenerations
    const scoringThresholdArg = args[2];
    const maxRegenerationsArg = args[3];

    expect(typeof scoringThresholdArg).toBe('number');
    expect(scoringThresholdArg).toBe(8);
    expect(typeof maxRegenerationsArg).toBe('number');
    expect(maxRegenerationsArg).toBe(5);
  });
});
