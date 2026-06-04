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

import {Config} from './config';
import {DropdownsSheetReader} from './dropdowns-sheet-reader';
import {
  BackgroundDefinition,
  getImageAssets,
  processImageAssets,
  saveSelectedImages,
} from './image-service';
import {loadIngredients} from './ingredients';
import {OnePrompt} from './one-prompt';

const HEADER_ROWS = 1;

/**
 * Serves the HTML entry point for the sidebar.
 */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createTemplateFromFile('ui').evaluate();
}

/**
 * Helper function to inline HTML assets into parent templates.
 */
export function include(filename: string): string {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates custom menus in the Google Sheet workspace.
 */
export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('BackgroundR on 🍌s')
    .addItem('🎨 Open configurator', 'showSidebar')
    .addItem('📥 Load images from Google Drive', 'getImagesFromDrive')
    .addItem('💾 Save selected images to Drive', 'saveSelectedImagesToDrive')
    .addItem('🧹 Clear generated images', 'clearGeneratedImages')
    .addToUi();
}

/**
 * Prompts user confirmation and clears all generated variation images from the spreadsheet.
 */
export function clearGeneratedImages(): void {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm',
    'Are you sure you want to clear generated images?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  const imageSheet = SpreadsheetApp.getActive().getSheetByName('Images');
  if (!imageSheet) {
    throw new Error("Sheet 'Images' not found");
  }
  imageSheet.getDataRange().offset(HEADER_ROWS, 2).clearContent();
}

/**
 * Prompts confirmation and loads all images from the configured Drive folder into the sheet.
 */
export function getImagesFromDrive(): void {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm',
    'This will clear the current images and load new ones from Drive. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }
  const config = Config.readConfig();
  getImageAssets(config['Drive Folder Id']);
}

/**
 * Evaluates the Sidebar template and renders the component sidebar panel.
 */
export function showSidebar(): void {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createTemplateFromFile('ui').evaluate().setTitle(' ')
  );
}

/**
 * Loads variant options, ingredients, and categorized menus to populate sidebar components.
 * Triggered from Angular frontend via `google.script.run`.
 */
export function loadDropDowns(): {
  variants: {[key: string]: string[]};
  ingredients: {
    [key: string]: {name: string; thumbnail: string; fileId: string}[];
  };
  menus: {title: string; items: string[]}[];
} {
  const config = Config.readConfig();
  const dropdownsData = DropdownsSheetReader.getDropdowns(
    config['Dropdowns sheet']
  );
  const ingredientsData = loadIngredients();
  let elementsMenu: {title: string; items: string[]}[];
  if (config['Elements Menu sheet']) {
    elementsMenu = DropdownsSheetReader.getElementsMenu(
      config['Elements Menu sheet']
    );
  } else {
    elementsMenu = [];
    const dropdownKeys = Object.keys(dropdownsData);
    if (dropdownKeys.length > 0) {
      elementsMenu.push({title: 'Dropdowns', items: dropdownKeys});
    }
    const ingredientKeys = Object.keys(ingredientsData);
    if (ingredientKeys.length > 0) {
      elementsMenu.push({title: 'Ingredients', items: ingredientKeys});
    }
  }
  return {
    variants: dropdownsData,
    ingredients: ingredientsData,
    menus: elementsMenu,
  };
}

/**
 * Resolves descriptions using categories selections and starts variation images generation.
 * Triggered from Angular frontend via `google.script.run`.
 */
export function generateImages(
  numberOfImages = 1,
  partsAsObject?: {
    [key: string]: string | null;
  },
  scoringThreshold?: number,
  maxRegenerations?: number,
  imageAspectRatio?: string,
  ingredientsAsObject?: {
    [key: string]: string | null;
  }
): void {
  const config = Config.readConfig();
  const prefix = config['Prompt Prefix'];
  const suffix = config['Prompt Suffix'];

  const prompt = partsAsObject
    ? OnePrompt.generatePrompt(
        partsAsObject,
        prefix,
        suffix,
        ingredientsAsObject as {[key: string]: string | null} | undefined
      )
    : OnePrompt.generatePromptForSheet(
        config['Dropdowns sheet'],
        prefix,
        suffix,
        ingredientsAsObject as {[key: string]: string | null} | undefined
      );

  console.log({prompt});

  const manyPrompts: BackgroundDefinition[] = new Array(numberOfImages)
    .fill(prompt)
    .map(p => ({
      description: p,
    }));

  processImageAssets(
    manyPrompts,
    config['Cloud Project Id'],
    config['GCP Location'],
    config['Image Generation Model'],
    scoringThreshold,
    maxRegenerations,
    imageAspectRatio
  );
}

/**
 * Downloads and saves all selected variations inside the active range to the configured Google Drive folder.
 */
export function saveSelectedImagesToDrive(): void {
  const config = Config.readConfig();
  const parentFolderId = config['Drive Folder Id'];
  if (!parentFolderId) {
    SpreadsheetApp.getActive().toast('Drive Folder Id not configured', 'Error');
    return;
  }

  try {
    const selection = SpreadsheetApp.getActive().getSelection();
    const result = saveSelectedImages(selection, parentFolderId);

    const html = HtmlService.createHtmlOutput(
      `<p>Saved ${result.savedCount} images to folder <a href="${result.folderUrl}" target="_blank">${result.folderName}</a></p>`
    )
      .setWidth(300)
      .setHeight(80);
    SpreadsheetApp.getUi().showModelessDialog(html, 'Images Saved');
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    SpreadsheetApp.getActive().toast(message, 'Error');
  }
}
