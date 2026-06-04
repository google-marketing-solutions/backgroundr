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
      'Scoring results sheet': 'Scoring',
      'Image Scoring Prompt': 'scoring-prompt',
      'Cloud Project Id': 'project-id',
      'Scoring Model': 'scoring-model',
      'GCP Location': 'gcp-location',
    }),
  },
}));

jest.mock('../gemini', () => ({
  queryGemini: jest.fn(),
}));

import {getScoringHeaders, scoreImage, addToScoringSheet} from '../scoring';

describe('scoring.ts', () => {
  let mockSheetScoring: any;
  let mockSpreadsheet: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSheetScoring = {
      getRange: jest.fn().mockReturnThis(),
      getDisplayValues: jest.fn(),
      getLastColumn: jest.fn(),
      getLastRow: jest.fn(),
      appendRow: jest.fn(),
      setValue: jest.fn(),
      setRowHeight: jest.fn().mockReturnThis(),
      setColumnWidth: jest.fn().mockReturnThis(),
    };

    mockSpreadsheet = {
      getSheetByName: jest.fn().mockReturnValue(mockSheetScoring),
    };

    (global as any).SpreadsheetApp = {
      getActive: jest.fn().mockReturnValue(mockSpreadsheet),
      newCellImage: jest.fn().mockReturnValue({
        setSourceUrl: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue('mock-cell-image'),
      }),
    };
  });

  describe('getScoringHeaders', () => {
    it('should retrieve headers starting from third column', () => {
      mockSheetScoring.getLastColumn.mockReturnValue(5);
      mockSheetScoring.getDisplayValues.mockReturnValue([
        ['Crit1', 'Crit2', 'Crit3'],
      ]);

      const result = getScoringHeaders();

      expect(result).toEqual(['Crit1', 'Crit2', 'Crit3']);
      expect(mockSheetScoring.getRange).toHaveBeenCalledWith(1, 3, 1, 3);
    });
  });

  describe('addToScoringSheet', () => {
    it('should format rows and write to scoring sheet', () => {
      mockSheetScoring.getLastColumn.mockReturnValue(4);
      mockSheetScoring.getDisplayValues.mockReturnValue([['Crit1', 'Crit2']]);
      mockSheetScoring.getLastRow.mockReturnValue(10);

      addToScoringSheet('base64-image', {
        Score: '9',
        Crit1: 'yes',
        Crit2: 'no',
      });

      expect(mockSheetScoring.appendRow).toHaveBeenCalledWith([
        '',
        '9',
        'yes',
        'no',
      ]);
      expect(mockSheetScoring.getRange).toHaveBeenCalledWith(11, 1, 1, 1);
      expect(mockSheetScoring.setValue).toHaveBeenCalledWith('mock-cell-image');
    });
  });

  describe('scoreImage', () => {
    it('should query Gemini and extract image score', () => {
      mockSheetScoring.getLastColumn.mockReturnValue(3);
      mockSheetScoring.getDisplayValues.mockReturnValue([['Crit1']]);
      mockSheetScoring.getLastRow.mockReturnValue(5);

      const gemini = require('../gemini');
      gemini.queryGemini.mockReturnValue('{\n"Score": "8",\n"Crit1": "yes"\n}');

      const result = scoreImage('base64-image');

      expect(result).toBe(8);
      expect(gemini.queryGemini).toHaveBeenCalled();
      expect(mockSheetScoring.appendRow).toHaveBeenCalled();
    });

    it('should throw ScoringError if JSON parsing fails', () => {
      mockSheetScoring.getLastColumn.mockReturnValue(3);
      mockSheetScoring.getDisplayValues.mockReturnValue([['Crit1']]);

      const gemini = require('../gemini');
      gemini.queryGemini.mockReturnValue('INVALID JSON RESPONSE');

      expect(() => scoreImage('base64-image')).toThrow();
    });
  });
});
