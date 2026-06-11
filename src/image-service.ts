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
import {
  ensureFolderExists,
  getFileById,
  getFolderById,
  listFiles,
  writeToDrive,
} from './drive-api';
import {PromptPart, queryGemini} from './gemini';
import {getImageResolution} from './image-utils';
import {scoreImage} from './scoring';

const HEADER_ROWS = 1;

export interface BackgroundDefinition {
  title?: string;
  description: PromptPart[];
}

interface ImageQueue {
  folderId: string;
  outputFolderId: string;
  fileName: string;
  fileId: string;
  prompt: string;
  variationId: number;
}

function getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }
  return sheet;
}

/**
 * Returns a list of image files to process from the 'Scaled' queue sheet.
 */
export function getImagesToProcess(): ImageQueue[] {
  const scaledSheet = getSheet('Scaled');
  const dataRange = scaledSheet.getDataRange();
  const values = dataRange.getValues();
  const imageQueue: ImageQueue[] = [];

  for (let i = 1; i < values.length; i++) {
    const folderId = values[i][1];
    const status = values[i][0];
    const prompts = new Set<string>();
    if (folderId === '' || status === 'DONE') {
      continue;
    }
    for (let p = 2; p < values[i].length; p++) {
      if (values[i][p] === '') {
        break;
      }
      prompts.add(values[i][p]);
    }
    const outputFolderId = ensureFolderExists(folderId);
    listFiles(folderId).forEach((file: GoogleAppsScript.Drive.File) => {
      let variationId = 1;
      prompts.forEach(prompt => {
        imageQueue.push({
          folderId,
          outputFolderId,
          fileName: file.getName(),
          fileId: file.getId(),
          prompt,
          variationId,
        });
        variationId++;
      });
    });
  }
  return imageQueue;
}

/**
 * Fetches up to 10 image files under 30MB from the specified Drive folder
 * and loads them into the 'Images' sheet for processing.
 *
 * @param folderId Google Drive folder containing source image assets.
 */
export function getImageAssets(folderId: string): void {
  const imageSheet = getSheet('Images');
  imageSheet.getDataRange().offset(HEADER_ROWS, 0).clearContent();

  listFiles(folderId)
    .filter((file: GoogleAppsScript.Drive.File) => file.getSize() < 30000000)
    .forEach((file: GoogleAppsScript.Drive.File) => {
      const fileBlob = file.getBlob();
      const bytes = fileBlob.getBytes();
      const base64Data = Utilities.base64Encode(bytes);
      const dataUrl = `data:${file.getMimeType()};base64,${base64Data}`;
      const cellImage = SpreadsheetApp.newCellImage()
        .setSourceUrl(dataUrl)
        .build();
      const row = [cellImage, file.getId()];
      const sheetRow = imageSheet.getLastRow() + 1;
      imageSheet.getRange(sheetRow, 1, 1, row.length).setValues([row]);
      imageSheet.setRowHeight(sheetRow, 256);
      imageSheet.setColumnWidth(1, 256);
    });
}

/**
 * Generates background variation images from descriptions, evaluates quality scores,
 * and sets them in the spreadsheet.
 */
export function processImageAssets(
  backgroundDefinitions: BackgroundDefinition[],
  scoringThreshold?: number,
  maxRegenerations?: number,
  imageAspectRatio?: string
): void {
  const config = Config.readConfig();
  const imageSheet = getSheet('Images');
  imageSheet
    .getRange('B:B')
    .offset(HEADER_ROWS, 0)
    .getValues()
    .forEach(([id], currentIndex) => {
      if (!id) {
        return;
      }
      const file = getFileById(id);
      const fileBlob = file.getBlob();
      const mimeType = file.getMimeType();
      const bytes = fileBlob.getBytes();
      const base64Data = Utilities.base64Encode(bytes);
      try {
        const variations = backgroundDefinitions.map((e, bgIndex) => {
          const currentImage = imageSheet
            .getRange(currentIndex + 1 + HEADER_ROWS, 5 + bgIndex, 1, 1)
            .getValue();
          if (currentImage !== '') {
            return null;
          }

          let resultImageBase64;
          if (scoringThreshold && maxRegenerations) {
            for (
              let attemptNumber = 0;
              attemptNumber < maxRegenerations + 1;
              attemptNumber++
            ) {
              resultImageBase64 = queryGemini(
                [
                  ...e.description,
                  {type: 'image', value: base64Data, mimeType: mimeType},
                ],
                config['Cloud Project Id'],
                config['Image Generation Model'],
                {},
                imageAspectRatio,
                config['GCP Location']
              );
              const imageScore = scoreImage(resultImageBase64);

              const cell = imageSheet.getRange(
                currentIndex + 1 + HEADER_ROWS,
                4
              );
              cell.setValue(
                cell.getValue() +
                  `Image #${bgIndex + 1}, attempt #${
                    attemptNumber + 1
                  }, Score: ${imageScore}\n`
              );

              if (imageScore >= scoringThreshold) {
                cell.setFontColor('#000000').setFontWeight('normal');
                break; // Stop generating
              } else {
                cell.setFontColor('#ff0000').setFontWeight('bold');
              }
            }
          } else {
            resultImageBase64 = queryGemini(
              [
                ...e.description,
                {type: 'image', value: base64Data, mimeType: mimeType},
              ],
              config['Cloud Project Id'],
              config['Image Generation Model'],
              {},
              imageAspectRatio,
              config['GCP Location']
            );
          }
          return SpreadsheetApp.newCellImage()
            .setSourceUrl(`data:image/png;base64,${resultImageBase64}`)
            .build();
        });
        variations.forEach((img, i) => {
          if (img) {
            imageSheet
              .getRange(currentIndex + 1 + HEADER_ROWS, 5 + i)
              .setValue(img);
          }
        });
        // Columns 3 (C) and 4 (D) store status and logs. Columns 5 (E) onwards
        // store the generated variation images. Set width for all these columns
        for (let i = 3; i < 5 + backgroundDefinitions.length; i++) {
          imageSheet.setColumnWidth(i, 256);
        }
      } catch (e) {
        imageSheet
          .getRange(currentIndex + 1, 1, 1, 1)
          .offset(HEADER_ROWS, 4)
          .setValue(`Error: ${e}`);
      }
    });
}

/**
 * Sets columns header names for each of the generated variations in the sheet.
 */
export function setHeaders(
  backgroundDefinitions: BackgroundDefinition[]
): void {
  const imageSheet = getSheet('Images');
  imageSheet.getRange('E1:Z1').clearContent();
  imageSheet
    .getRange(1, 5, 1, backgroundDefinitions.length)
    .setValues([backgroundDefinitions.map(e => e.title)]);
}

/**
 * Appends a folder to process into the Scaled sheet queue.
 */
export function addFolderToQueue(
  folderName: string,
  backgroundDefinitions: BackgroundDefinition[]
): void {
  const scaledSheet = getSheet('Scaled');
  scaledSheet.appendRow([
    '',
    folderName,
    ...backgroundDefinitions.map(e => e.description),
  ]);
  SpreadsheetApp.getActive().setActiveSheet(scaledSheet);
}

/**
 * Extracts, downloads, and copies all selected images from active ranges in spreadsheet to Google Drive.
 *
 * @param selection Selection range to scan for images.
 * @param parentFolderId Target parent Google Drive folder ID.
 * @returns Result summary detailing saved count, target folder URL and folder name.
 */
export function saveSelectedImages(
  selection: GoogleAppsScript.Spreadsheet.Selection,
  parentFolderId: string
): {savedCount: number; folderUrl: string; folderName: string} {
  const imagesToSave: {
    base64: string;
    mimeType: string;
    fileName?: string;
  }[] = [];
  const ranges = selection.getActiveRangeList()?.getRanges() || [];
  const activeSheet = SpreadsheetApp.getActive().getActiveSheet();
  const isImageSheet = activeSheet.getName() === 'Images';
  const fileNameCache = new Map<string, string>();

  ranges.forEach(range => {
    const sheet = range.getSheet();
    const canFetchOriginalName = isImageSheet && sheet.getName() === 'Images';
    const startRow = range.getRow();
    const numRows = range.getNumRows();

    let rowIds: string[] = [];
    if (canFetchOriginalName) {
      try {
        rowIds = sheet
          .getRange(startRow, 2, numRows, 1)
          .getValues()
          .map(v => String(v[0]));
      } catch (e) {
        console.warn('Failed to fetch Drive IDs from column B', e);
      }
    }

    const values = range.getValues();
    values.forEach((row, rowIndex) => {
      let originalName = '';
      if (canFetchOriginalName && rowIds[rowIndex]) {
        const driveId = rowIds[rowIndex];
        if (driveId) {
          if (fileNameCache.has(driveId)) {
            originalName = fileNameCache.get(driveId)!;
          } else {
            try {
              const file = getFileById(driveId);
              const name = file.getName();
              originalName = name.replace(/\.[^/.]+$/, '');
              fileNameCache.set(driveId, originalName);
            } catch (e) {
              console.warn(`Could not get file for id ${driveId}`, e);
            }
          }
        }
      }

      row.forEach(cellValue => {
        if (isCellImage(cellValue)) {
          try {
            const url = cellValue.getContentUrl();
            const response = UrlFetchApp.fetch(url);
            const blob = response.getBlob();
            const resolution = getImageResolution(blob);
            let suffix = '_generated';
            if (resolution) {
              suffix += `_${resolution.width}x${resolution.height}`;
            }

            imagesToSave.push({
              mimeType: blob.getContentType() || 'image/png',
              base64: Utilities.base64Encode(blob.getBytes()),
              fileName: originalName ? `${originalName}${suffix}` : undefined,
            });
          } catch (e) {
            console.error('Failed to fetch CellImage content', e);
          }
        } else if (
          typeof cellValue === 'string' &&
          cellValue.startsWith('data:image/')
        ) {
          const match = cellValue.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64 = match[2];
            let suffix = '_generated';
            try {
              const blob = Utilities.newBlob(
                Utilities.base64Decode(base64),
                mimeType
              );
              const resolution = getImageResolution(blob);
              if (resolution) {
                suffix += `_${resolution.width}x${resolution.height}`;
              }
            } catch (e) {
              console.warn('Failed to get resolution from base64 string', e);
            }

            imagesToSave.push({
              mimeType,
              base64,
              fileName: originalName ? `${originalName}${suffix}` : undefined,
            });
          }
        }
      });
    });
  });

  if (imagesToSave.length === 0) {
    throw new Error('No images found in selection');
  }

  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
  const folderName = `${timestamp}`;
  const parent = getFolderById(parentFolderId);
  const newFolder = parent.createFolder(folderName);
  const folderId = newFolder.getId();
  const folderUrl = newFolder.getUrl();

  let savedCount = 0;
  imagesToSave.forEach((img, index) => {
    try {
      const name = img.fileName || `image_${index + 1}`;
      writeToDrive(folderId, name, img.base64, img.mimeType);
      savedCount++;
    } catch (e) {
      console.error(`Failed to save image ${index + 1}`, e);
    }
  });

  return {savedCount, folderUrl, folderName};
}

function isCellImage(
  value: unknown
): value is GoogleAppsScript.Spreadsheet.CellImage {
  return (
    typeof value === 'object' && value !== null && 'getContentUrl' in value
  );
}
