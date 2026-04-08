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

import { Config } from '../src/config';

describe('Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readConfig', () => {
    const setupMockSpreadsheet = (mockValues: string[][]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).SpreadsheetApp = {
        getActiveSpreadsheet: jest.fn().mockReturnValue({
          getSheetByName: jest.fn().mockReturnValue({
            getRange: jest.fn().mockReturnValue({
              getDisplayValues: jest.fn().mockReturnValue(mockValues),
            }),
          }),
        }),
      };
    };

    it('should read all config values by default', () => {
      const mockValues = [
        ['KEY1', 'VALUE1'],
        ['KEY2', 'VALUE2'],
        ['', 'IGNORE'], // Empty key
        ['KEY3', ''], // Empty value
      ];

      setupMockSpreadsheet(mockValues);

      const result = Config.readConfig();

      expect(result).toEqual({
        KEY1: 'VALUE1',
        KEY2: 'VALUE2',
        KEY3: '',
      });
    });

    it('should filter by configVariables', () => {
      const mockValues = [
        ['KEY1', 'VALUE1'],
        ['KEY2', 'VALUE2'],
        ['KEY3', 'VALUE3'],
      ];

      setupMockSpreadsheet(mockValues);

      const result = Config.readConfig('Config', ['KEY1', 'KEY3']);

      expect(result).toEqual({
        KEY1: 'VALUE1',
        KEY3: 'VALUE3',
      });
    });

    it('should filter onlyWithNonEmptyValues', () => {
      const mockValues = [
        ['KEY1', 'VALUE1'],
        ['KEY2', ''],
        ['KEY3', 'VALUE3'],
      ];

      setupMockSpreadsheet(mockValues);

      const result = Config.readConfig('Config', undefined, true);

      expect(result).toEqual({
        KEY1: 'VALUE1',
        KEY3: 'VALUE3',
      });
    });

    it('should return empty object if sheet is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).SpreadsheetApp = {
        getActiveSpreadsheet: jest.fn().mockReturnValue({
          getSheetByName: jest.fn().mockReturnValue(null),
        }),
      };

      const result = Config.readConfig('NonExistentSheet');
      expect(result).toEqual({});
    });

    it('should handle missing SpreadsheetApp gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).SpreadsheetApp = undefined;

      const result = Config.readConfig();

      expect(result).toEqual({});
    });
  });
});
