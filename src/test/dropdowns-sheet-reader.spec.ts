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

import {DropdownsSheetReader} from '../dropdowns-sheet-reader';

describe('DropdownsSheetReader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupMockSpreadsheet = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSheet: any | null = null,
    hasActiveSpreadsheet = true
  ) => {
    const mockActiveSpreadsheet = hasActiveSpreadsheet
      ? {
          getSheetByName: jest.fn().mockReturnValue(mockSheet),
        }
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn().mockReturnValue(mockActiveSpreadsheet),
    };
  };

  describe('getDropdowns', () => {
    it('should throw error if no active spreadsheet found', () => {
      setupMockSpreadsheet(null, false);
      expect(() => DropdownsSheetReader.getDropdowns('MySheet')).toThrow(
        'No active spreadsheet found'
      );
    });

    it('should throw error if sheet not found', () => {
      setupMockSpreadsheet(null);
      expect(() => DropdownsSheetReader.getDropdowns('MissingSheet')).toThrow(
        'Sheet "MissingSheet" not found'
      );
    });

    it('should correctly parse valid dropdown values', () => {
      const mockDataRange = {
        getDisplayValues: jest.fn().mockReturnValue([
          ['Style', 'Color', 'Subject'],
          ['Vector', 'Blue', 'Cat'],
          ['3D Render', '', 'Dog'],
          ['', 'Red', ''],
        ]),
      };
      const mockSheet = {
        getDataRange: jest.fn().mockReturnValue(mockDataRange),
      };
      setupMockSpreadsheet(mockSheet);

      const result = DropdownsSheetReader.getDropdowns('DropdownSheet');
      expect(result).toEqual({
        Style: ['Vector', '3D Render'],
        Color: ['Blue', 'Red'],
        Subject: ['Cat', 'Dog'],
      });
    });

    it('should return empty object if sheet is empty', () => {
      const mockDataRange = {
        getDisplayValues: jest.fn().mockReturnValue([]),
      };
      const mockSheet = {
        getDataRange: jest.fn().mockReturnValue(mockDataRange),
      };
      setupMockSpreadsheet(mockSheet);

      expect(DropdownsSheetReader.getDropdowns('EmptySheet')).toEqual({});
    });

    it('should return empty object if headers are missing', () => {
      const mockDataRange = {
        getDisplayValues: jest.fn().mockReturnValue([[]]),
      };
      const mockSheet = {
        getDataRange: jest.fn().mockReturnValue(mockDataRange),
      };
      setupMockSpreadsheet(mockSheet);

      expect(DropdownsSheetReader.getDropdowns('NoHeaderSheet')).toEqual({});
    });
  });

  describe('getElementsMenu', () => {
    it('should throw error if sheet not found', () => {
      setupMockSpreadsheet(null);
      expect(() =>
        DropdownsSheetReader.getElementsMenu('MissingSheet')
      ).toThrow('Sheet "MissingSheet" not found');
    });

    it('should return empty array if lastColumn < 2', () => {
      const mockSheet = {
        getLastColumn: jest.fn().mockReturnValue(1),
        getLastRow: jest.fn().mockReturnValue(5),
      };
      setupMockSpreadsheet(mockSheet);

      expect(DropdownsSheetReader.getElementsMenu('MenuSheet')).toEqual([]);
    });

    it('should parse elements menu from column B onwards', () => {
      const mockRange = {
        getDisplayValues: jest.fn().mockReturnValue([
          ['Category A', 'Category B'],
          ['Item A1', 'Item B1'],
          ['', 'Item B2'],
          ['Item A2', ''],
        ]),
      };
      const mockSheet = {
        getLastColumn: jest.fn().mockReturnValue(3),
        getLastRow: jest.fn().mockReturnValue(4),
        getRange: jest.fn().mockReturnValue(mockRange),
      };
      setupMockSpreadsheet(mockSheet);

      const result = DropdownsSheetReader.getElementsMenu('MenuSheet');

      expect(mockSheet.getRange).toHaveBeenCalledWith(1, 2, 4, 2);
      expect(result).toEqual([
        {
          title: 'Category A',
          items: ['Item A1', 'Item A2'],
        },
        {
          title: 'Category B',
          items: ['Item B1', 'Item B2'],
        },
      ]);
    });
  });
});
