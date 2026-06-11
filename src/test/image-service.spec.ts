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
      'Drive Folder Id': 'mock-drive-folder-id',
      'Cloud Project Id': 'mock-project-id',
      'Image Generation Model': 'mock-model-image',
      'GCP Location': 'mock-location',
    }),
  },
}));

jest.mock('../drive-api', () => ({
  ensureFolderExists: jest.fn(),
  getFileById: jest.fn(),
  getFolderById: jest.fn(),
  listFiles: jest.fn(),
  writeToDrive: jest.fn(),
}));

jest.mock('../gemini', () => ({
  queryGemini: jest.fn(),
}));

jest.mock('../image-utils', () => ({
  getImageResolution: jest.fn(),
}));

jest.mock('../scoring', () => ({
  scoreImage: jest.fn(),
}));

import {
  getImagesToProcess,
  getImageAssets,
  processImageAssets,
  setHeaders,
  addFolderToQueue,
  saveSelectedImages,
} from '../image-service';

describe('image-service.ts', () => {
  let mockSheetImages: any;
  let mockSheetScaled: any;
  let mockSpreadsheet: any;
  let mockBlob: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSheetImages = {
      getDataRange: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clearContent: jest.fn(),
      getLastRow: jest.fn(),
      getRange: jest.fn().mockReturnThis(),
      setValues: jest.fn(),
      setValue: jest.fn(),
      setRowHeight: jest.fn().mockReturnThis(),
      setColumnWidth: jest.fn().mockReturnThis(),
      getValues: jest.fn(),
      getValue: jest.fn(),
      getName: jest.fn().mockReturnValue('Images'),
    };

    mockSheetScaled = {
      getDataRange: jest.fn().mockReturnThis(),
      getValues: jest.fn(),
      appendRow: jest.fn(),
      getName: jest.fn().mockReturnValue('Scaled'),
    };

    mockSpreadsheet = {
      getSheetByName: jest.fn((name: string) => {
        if (name === 'Images') return mockSheetImages;
        if (name === 'Scaled') return mockSheetScaled;
        return null;
      }),
      setActiveSheet: jest.fn(),
      getActiveSheet: jest.fn().mockReturnValue(mockSheetImages),
    };

    (global as any).SpreadsheetApp = {
      getActive: jest.fn().mockReturnValue(mockSpreadsheet),
      newCellImage: jest.fn().mockReturnValue({
        setSourceUrl: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue('mock-cell-image'),
      }),
    };

    (global as any).Utilities = {
      base64Encode: jest.fn().mockReturnValue('mock-base64'),
      base64Decode: jest.fn().mockReturnValue('mock-bytes'),
      formatDate: jest.fn().mockReturnValue('mock-date'),
      newBlob: jest.fn().mockReturnValue('mock-blob'),
    };

    (global as any).Session = {
      getScriptTimeZone: jest.fn().mockReturnValue('mock-timezone'),
    };

    (global as any).UrlFetchApp = {
      fetch: jest.fn().mockReturnValue({
        getBlob: jest.fn().mockReturnValue(mockBlob),
      }),
    };

    mockBlob = {
      getContentType: jest.fn().mockReturnValue('image/png'),
      getBytes: jest.fn().mockReturnValue([1, 2, 3]),
    };
  });

  describe('getImagesToProcess', () => {
    it('should query Scaled sheet and output ImageQueue objects', () => {
      mockSheetScaled.getValues.mockReturnValue([
        ['status', 'folderId', 'p1'],
        ['TODO', 'folder-1', 'scenic bg'],
      ]);

      const driveApi = require('../drive-api');
      driveApi.ensureFolderExists.mockReturnValue('out-folder-1');
      driveApi.listFiles.mockReturnValue([
        {
          getName: () => 'img1.jpg',
          getId: () => 'img1-id',
        },
      ]);

      const result = getImagesToProcess();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        folderId: 'folder-1',
        outputFolderId: 'out-folder-1',
        fileName: 'img1.jpg',
        fileId: 'img1-id',
        prompt: 'scenic bg',
        variationId: 1,
      });
    });
  });

  describe('getImageAssets', () => {
    it('should read folder files and write base64 strings to Images sheet', () => {
      const driveApi = require('../drive-api');
      driveApi.listFiles.mockReturnValue([
        {
          getSize: () => 100,
          getBlob: () => mockBlob,
          getMimeType: () => 'image/png',
          getId: () => 'img-id',
        },
      ]);
      mockSheetImages.getLastRow.mockReturnValue(1);

      getImageAssets('folder-id-1');

      expect(mockSheetImages.getRange).toHaveBeenCalled();
      expect(mockSheetImages.setValues).toHaveBeenCalled();
    });
  });

  describe('processImageAssets', () => {
    it('should generate background variations using Gemini api', () => {
      mockSheetImages.getValues.mockReturnValue([['id'], ['img-id-1']]);
      mockSheetImages.getValue.mockReturnValue(''); // No current variation

      const driveApi = require('../drive-api');
      driveApi.getFileById.mockReturnValue({
        getBlob: () => mockBlob,
        getMimeType: () => 'image/png',
      });

      const gemini = require('../gemini');
      gemini.queryGemini.mockReturnValue('generated-base64');

      processImageAssets([
        {
          title: 'Variation 1',
          description: [{type: 'text', value: 'scenic prompt'}],
        },
      ]);

      expect(gemini.queryGemini).toHaveBeenCalled();
      expect(mockSheetImages.setValue).toHaveBeenCalled();
    });

    it('should regenerate image if score is below threshold', () => {
      mockSheetImages.getValues.mockReturnValue([['id'], ['img-id-1']]);
      mockSheetImages.getValue.mockReturnValue('');

      const driveApi = require('../drive-api');
      driveApi.getFileById.mockReturnValue({
        getBlob: () => mockBlob,
        getMimeType: () => 'image/png',
      });

      const gemini = require('../gemini');
      gemini.queryGemini.mockReturnValue('generated-base64');

      const scoring = require('../scoring');
      scoring.scoreImage.mockReturnValueOnce(2).mockReturnValueOnce(8); // score improves on attempt #2

      processImageAssets(
        [{title: 'Var1', description: [{type: 'text', value: 'scenic'}]}],
        5, // threshold
        2 // maxRegenerations
      );

      expect(scoring.scoreImage).toHaveBeenCalledTimes(2);
      expect(gemini.queryGemini).toHaveBeenCalledTimes(2);
    });
  });

  describe('setHeaders', () => {
    it('should clear old headers and write new headers to Images sheet', () => {
      setHeaders([
        {title: 'Header A', description: []},
        {title: 'Header B', description: []},
      ]);

      expect(mockSheetImages.getRange).toHaveBeenCalledWith('E1:Z1');
      expect(mockSheetImages.clearContent).toHaveBeenCalled();
      expect(mockSheetImages.getRange).toHaveBeenLastCalledWith(1, 5, 1, 2);
      expect(mockSheetImages.setValues).toHaveBeenCalledWith([
        ['Header A', 'Header B'],
      ]);
    });
  });

  describe('addFolderToQueue', () => {
    it('should add row description to Scaled sheet queue and set sheet active', () => {
      addFolderToQueue('folder-name-1', [
        {title: 'Var 1', description: [{type: 'text', value: 'prompt 1'}]},
      ]);

      expect(mockSheetScaled.appendRow).toHaveBeenCalledWith([
        '',
        'folder-name-1',
        [{type: 'text', value: 'prompt 1'}],
      ]);
      expect(mockSpreadsheet.setActiveSheet).toHaveBeenCalledWith(
        mockSheetScaled
      );
    });
  });

  describe('saveSelectedImages', () => {
    it('should extract selections and save images to a new folder', () => {
      const mockRange = {
        getSheet: jest.fn().mockReturnValue({
          getName: () => 'Images',
          getRange: jest.fn().mockReturnThis(),
          getValues: jest.fn().mockReturnValue([['drive-id-1']]),
        }),
        getRow: () => 2,
        getNumRows: () => 1,
        getValues: jest.fn().mockReturnValue([
          [
            {
              getContentUrl: () => 'http://content-url',
            },
          ],
        ]),
      };

      const mockSelection = {
        getActiveRangeList: jest.fn().mockReturnValue({
          getRanges: () => [mockRange],
        }),
      };

      const driveApi = require('../drive-api');
      driveApi.getFileById.mockReturnValue({
        getName: () => 'original.jpg',
      });

      const mockNewFolder = {
        getId: () => 'new-folder-id',
        getUrl: () => 'http://new-folder-url',
      };

      driveApi.getFolderById.mockReturnValue({
        createFolder: jest.fn().mockReturnValue(mockNewFolder),
      });

      const result = saveSelectedImages(
        mockSelection as any,
        'parent-folder-id'
      );

      expect(result.savedCount).toBe(1);
      expect(result.folderUrl).toBe('http://new-folder-url');
      expect(driveApi.writeToDrive).toHaveBeenCalled();
    });
  });
});
