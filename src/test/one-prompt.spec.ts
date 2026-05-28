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

import { getFileById } from '../drive-api';
import { OnePrompt } from '../one-prompt';
import { DropdownsSheetReader } from '../dropdowns-sheet-reader';

jest.mock('../dropdowns-sheet-reader');
jest.mock('../drive-api');

describe('OnePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePromptForSheet', () => {
    it('should fetch dropdowns and generate prompt parts', () => {
      const mockDropdowns = {
        Style: 'Vector',
        Color: ['Blue', 'Red'],
      };
      (DropdownsSheetReader.getDropdowns as jest.Mock).mockReturnValue(
        mockDropdowns
      );

      const result = OnePrompt.generatePromptForSheet(
        'MySheet',
        'Prefix',
        'Suffix'
      );

      const expectedValue =
        'Prefix\n\n' +
        '### Style:\n* Vector\n\n' +
        '### Color:\n* Blue\n* Red\n\n' +
        'Suffix';

      expect(DropdownsSheetReader.getDropdowns).toHaveBeenCalledWith('MySheet');
      expect(result).toEqual([
        {
          type: 'text',
          value: expectedValue,
        },
      ]);
    });
  });

  describe('generatePrompt', () => {
    it('should build correct multimodal parts with ingredients', () => {
      const mockBlob = {
        getBytes: jest.fn().mockReturnValue([1, 2, 3]),
        getContentType: jest.fn().mockReturnValue('image/png'),
      };
      const mockFile = {
        getBlob: jest.fn().mockReturnValue(mockBlob),
      };
      (getFileById as jest.Mock).mockReturnValue(mockFile);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).Utilities = {
        base64Encode: jest.fn().mockReturnValue('MockedBase64'),
      };

      const partsAsObject = { Style: 'Vector' };
      const ingredients = { Logo: 'file-id-123' };

      const result = OnePrompt.generatePrompt(
        partsAsObject,
        'Prefix',
        'Suffix',
        ingredients
      );

      expect(getFileById).toHaveBeenCalledWith('file-id-123');
      expect(Utilities.base64Encode).toHaveBeenCalledWith([1, 2, 3]);
      expect(result).toEqual([
        {
          type: 'text',
          value: 'Prefix\n\n### Style:\n* Vector\n\nSuffix',
        },
        {
          type: 'text',
          value: 'Use only the following Logo',
        },
        {
          type: 'image',
          value: 'MockedBase64',
          mimeType: 'image/png',
        },
      ]);
    });
  });

  describe('generateTextPromptParts', () => {
    it('should compile markdown from arrays and non-arrays', () => {
      const dropdowns = {
        Style: 'Vector',
        Sub: ['SubValue1', 'SubValue2'],
      };

      const parts = OnePrompt.generateTextPromptParts(dropdowns);

      expect(parts).toEqual([
        '### Style:\n* Vector',
        '### Sub:\n* SubValue1\n* SubValue2',
      ]);
    });
  });
});
