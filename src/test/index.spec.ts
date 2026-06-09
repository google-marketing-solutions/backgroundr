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

// Mock internal modules
jest.mock('../config', () => ({
  Config: {
    readConfig: jest.fn().mockReturnValue({
      'Drive Folder Id': 'mock-drive-folder-id',
      'Dropdowns sheet': 'mock-dropdowns-sheet',
      'Elements Menu sheet': 'mock-elements-menu-sheet',
      'Prompt Prefix': 'mock-prefix',
      'Prompt Suffix': 'mock-suffix',
      'Cloud Project Id': 'mock-cloud-project-id',
      'GCP Location': 'mock-gcp-location',
      'Image Generation Model': 'mock-image-generation-model',
    }),
  },
}));

jest.mock('../one-prompt', () => ({
  OnePrompt: {
    generatePrompt: jest
      .fn()
      .mockReturnValue([{type: 'text', value: 'generated-prompt'}]),
    generatePromptForSheet: jest
      .fn()
      .mockReturnValue([{type: 'text', value: 'generated-prompt-sheet'}]),
  },
}));

jest.mock('../dropdowns-sheet-reader', () => ({
  DropdownsSheetReader: {
    getDropdowns: jest.fn(),
    getElementsMenu: jest.fn(),
  },
}));

jest.mock('../ingredients', () => ({
  loadIngredients: jest.fn(),
}));

jest.mock('../image-service', () => ({
  getImageAssets: jest.fn(),
  processImageAssets: jest.fn(),
  saveSelectedImages: jest.fn(),
}));

import {
  doGet,
  include,
  onOpen,
  clearGeneratedImages,
  getImagesFromDrive,
  showSidebar,
  loadDropDowns,
  generateImages,
  saveSelectedImagesToDrive,
} from '../index';

const mockUi: any = {
  createMenu: jest.fn().mockReturnThis(),
  addItem: jest.fn().mockReturnThis(),
  addToUi: jest.fn(),
  alert: jest.fn(),
  showSidebar: jest.fn(),
  showModelessDialog: jest.fn(),
  ButtonSet: {YES_NO: 'YES_NO'},
  Button: {YES: 'YES'},
};

const mockSpreadsheet: any = {
  getSheetByName: jest.fn().mockReturnValue({
    getDataRange: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    clearContent: jest.fn(),
  }),
  getSelection: jest.fn().mockReturnValue('mock-selection'),
  toast: jest.fn(),
};

beforeAll(() => {
  (global as any).SpreadsheetApp = {
    getActive: jest.fn().mockReturnValue(mockSpreadsheet),
    getUi: jest.fn().mockReturnValue(mockUi),
  };

  (global as any).HtmlService = {
    createTemplateFromFile: jest.fn().mockReturnValue({
      evaluate: jest.fn().mockReturnValue({
        setTitle: jest.fn().mockReturnThis(),
      }),
    }),
    createHtmlOutputFromFile: jest.fn().mockReturnValue({
      getContent: jest.fn().mockReturnValue('mock-html-content'),
    }),
    createHtmlOutput: jest.fn().mockReturnValue({
      setWidth: jest.fn().mockReturnThis(),
      setHeight: jest.fn().mockReturnValue('mock-html-output'),
    }),
  };
});

describe('index.ts Entry Points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('doGet', () => {
    it('should evaluate the ui template', () => {
      const result = doGet();
      expect(global.HtmlService.createTemplateFromFile).toHaveBeenCalledWith(
        'ui'
      );
      expect(result).toBeDefined();
    });
  });

  describe('include', () => {
    it('should return HTML output file content', () => {
      const result = include('test-file');
      expect(global.HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith(
        'test-file'
      );
      expect(result).toBe('mock-html-content');
    });
  });

  describe('onOpen', () => {
    it('should create menu and add to UI', () => {
      onOpen();
      expect(mockUi.createMenu).toHaveBeenCalledWith('BackgroundR on 🍌s');
      expect(mockUi.addItem).toHaveBeenCalledWith(
        '🎨 Open configurator',
        'showSidebar'
      );
      expect(mockUi.addToUi).toHaveBeenCalled();
    });
  });

  describe('clearGeneratedImages', () => {
    it('should clear range if user confirms', () => {
      mockUi.alert.mockReturnValue('YES');

      clearGeneratedImages();

      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('Images');
    });

    it('should do nothing if user cancels', () => {
      mockUi.alert.mockReturnValue('NO');

      clearGeneratedImages();

      expect(mockSpreadsheet.getSheetByName).not.toHaveBeenCalled();
    });
  });

  describe('getImagesFromDrive', () => {
    it('should load images if user confirms', () => {
      mockUi.alert.mockReturnValue('YES');

      const imageService = require('../image-service');

      getImagesFromDrive();

      expect(imageService.getImageAssets).toHaveBeenCalledWith(
        'mock-drive-folder-id'
      );
    });
  });

  describe('showSidebar', () => {
    it('should evaluate and show template as sidebar', () => {
      showSidebar();
      expect(mockUi.showSidebar).toHaveBeenCalled();
    });
  });

  describe('loadDropDowns', () => {
    it('should read configurations and load dropdowns, ingredients, and menus', () => {
      const reader = require('../dropdowns-sheet-reader');
      reader.DropdownsSheetReader.getDropdowns.mockReturnValue({test: ['1']});
      reader.DropdownsSheetReader.getElementsMenu.mockReturnValue([
        {title: 'Elements', items: ['test']},
      ]);

      const ingredients = require('../ingredients');
      ingredients.loadIngredients.mockReturnValue({Ingredient1: []});

      const result = loadDropDowns();

      expect(reader.DropdownsSheetReader.getDropdowns).toHaveBeenCalledWith(
        'mock-dropdowns-sheet'
      );
      expect(ingredients.loadIngredients).toHaveBeenCalled();
      expect(result.variants).toEqual({test: ['1']});
      expect(result.ingredients.Ingredient1).toBeDefined();
    });
  });

  describe('generateImages', () => {
    it('should generate prompts and call processImageAssets', () => {
      const imageService = require('../image-service');

      generateImages(2, {category: 'value'});

      expect(imageService.processImageAssets).toHaveBeenCalledWith(
        expect.any(Array),
        'mock-cloud-project-id',
        'mock-gcp-location',
        'mock-image-generation-model',
        undefined,
        undefined,
        undefined
      );
    });
  });

  describe('saveSelectedImagesToDrive', () => {
    it('should delegate to saveSelectedImages and show confirmation dialog', () => {
      const imageService = require('../image-service');
      imageService.saveSelectedImages.mockReturnValue({
        savedCount: 3,
        folderUrl: 'http://folder-url',
        folderName: 'folder-name',
      });

      saveSelectedImagesToDrive();

      expect(imageService.saveSelectedImages).toHaveBeenCalledWith(
        'mock-selection',
        'mock-drive-folder-id'
      );
      expect(mockUi.showModelessDialog).toHaveBeenCalled();
    });

    it('should toast error if saveSelectedImages throws', () => {
      const imageService = require('../image-service');
      imageService.saveSelectedImages.mockImplementation(() => {
        throw new Error('Save error');
      });

      saveSelectedImagesToDrive();

      expect(mockSpreadsheet.toast).toHaveBeenCalledWith('Save error', 'Error');
    });
  });
});
