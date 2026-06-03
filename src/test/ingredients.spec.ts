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

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../config', () => ({
  Config: {
    readConfig: jest.fn().mockReturnValue({
      'Ingredients sheet': 'Ingredients',
    }),
  },
}));

jest.mock('../drive-api', () => ({
  listFiles: jest.fn(),
}));

import {loadIngredients} from '../ingredients';

describe('ingredients.ts', () => {
  let mockBlob: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBlob = {
      getContentType: jest.fn().mockReturnValue('image/png'),
      getBytes: jest.fn().mockReturnValue([1, 2, 3]),
    };

    (global as any).Utilities = {
      base64Encode: jest.fn().mockReturnValue('mock-base-64'),
    };
  });

  describe('loadIngredients', () => {
    it('should read from Ingredients sheet and generate thumbnail URLs', () => {
      const mockSpreadsheetWithIngredients = {
        getSheetByName: jest.fn().mockReturnValue({
          getDataRange: jest.fn().mockReturnThis(),
          getDisplayValues: jest.fn().mockReturnValue([
            ['headerName', 'folderId'],
            ['Ingredient1', 'folder-id-1'],
          ]),
        }),
      };
      (global as any).SpreadsheetApp = {
        getActiveSpreadsheet: jest
          .fn()
          .mockReturnValue(mockSpreadsheetWithIngredients),
      };

      const driveApi = require('../drive-api');
      driveApi.listFiles.mockReturnValue([
        {
          getId: () => 'file-id-1',
          getName: () => 'file-name-1',
          getBlob: () => mockBlob,
        },
      ]);

      const result = loadIngredients();

      expect(result).toEqual({
        Ingredient1: [
          {
            fileId: 'file-id-1',
            name: 'file-name-1',
            thumbnail: 'data:image/png;base64,mock-base-64',
          },
        ],
      });
      expect(driveApi.listFiles).toHaveBeenCalledWith('folder-id-1');
    });

    it('should throw an error if the ingredients sheet is missing', () => {
      const mockSpreadsheetMissingSheet = {
        getSheetByName: jest.fn().mockReturnValue(null),
      };
      (global as any).SpreadsheetApp = {
        getActiveSpreadsheet: jest
          .fn()
          .mockReturnValue(mockSpreadsheetMissingSheet),
      };

      expect(() => loadIngredients()).toThrow('Sheet Ingredients not found');
    });

    it('should return empty object if sheet data is empty', () => {
      const mockSpreadsheetEmpty = {
        getSheetByName: jest.fn().mockReturnValue({
          getDataRange: jest.fn().mockReturnThis(),
          getDisplayValues: jest.fn().mockReturnValue([]),
        }),
      };
      (global as any).SpreadsheetApp = {
        getActiveSpreadsheet: jest.fn().mockReturnValue(mockSpreadsheetEmpty),
      };

      const result = loadIngredients();

      expect(result).toEqual({});
    });
  });
});
