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

import * as driveApi from '../src/drive-api';
import { OnePrompt } from '../src/one-prompt';

// Mock dependencies
jest.mock('../src/drive-api');
const mockGetFileById = driveApi.getFileById as jest.Mock;

describe('OnePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SpreadsheetApp global
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn().mockReturnValue({
        getSheetByName: jest.fn().mockReturnValue({
          getDataRange: jest.fn().mockReturnValue({
            getDisplayValues: jest
              .fn()
              .mockReturnValue([['Header1'], ['Value1']]),
          }),
        }),
      }),
    };

    // Mock Utilities global
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Utilities = {
      base64Encode: jest.fn().mockReturnValue('mockBase64'),
      newBlob: jest.fn(),
    };
  });

  describe('generatePrompt', () => {
    it('should include ingredients even if they are not in dropdowns', () => {
      // Setup
      const partsAsObject = {
        Dropdown1: ['Value1'],
      };
      const ingredients = {
        Dropdown1: 'id1', // Should be included (matches dropdown)
        IndependentIngredient: 'id2', // Should ALSO be included (does not match dropdown)
      };

      // Mock drive files
      const mockFile = {
        getBlob: jest.fn().mockReturnValue({
          getBytes: jest.fn().mockReturnValue([]),
          getContentType: jest.fn().mockReturnValue('image/png'),
        }),
      };
      mockGetFileById.mockReturnValue(mockFile);

      // Execute
      const result = OnePrompt.generatePrompt(
        partsAsObject,
        '',
        '',
        ingredients
      );

      // Assert
      // We expect 4 parts:
      // 1. Text prompt (dropdowns)
      // 2. Ingredient 1 text
      // 3. Ingredient 1 image
      // 4. Ingredient 2 text
      // 5. Ingredient 2 image
      // Wait, let's check the code.
      // OnePrompt.generateTextPrompt generates one text part.
      // Then ingredients are active.

      const textParts = result.filter(p => p.type === 'text');
      const imageParts = result.filter(p => p.type === 'image');

      // Expect text prompt + 2 ingredients * 1 text instruction each = 3 active text parts
      // Actually usually it is:
      // Part 0: Main text prompt
      // Part 1: "Use only the following ..." (for ingredient 1)
      // Part 2: Image (for ingredient 1)
      // Part 3: "Use only the following ..." (for ingredient 2)
      // Part 4: Image (for ingredient 2)

      // WITH THE BUG: 'IndependentIngredient' is skipped because it's not in partsAsObject AND partsAsObject has active parts.
      // WITH THE FIX: 'IndependentIngredient' is included.

      const ingredientTexts = textParts
        .map(p => p.value)
        .filter(v => v.includes('Use only the following'));

      // Before fix, this expects to fail if we assertion 2 ingredients
      expect(ingredientTexts).toContain('Use only the following Dropdown1');
      expect(ingredientTexts).toContain(
        'Use only the following IndependentIngredient'
      );
      expect(imageParts).toHaveLength(2);
    });
  });
});
