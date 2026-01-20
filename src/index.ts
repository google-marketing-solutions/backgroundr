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

import { Config } from './config';
import { ensureFolderExists, getFileById, listFiles } from './drive-api';
import { queryGemini } from './gemini';
import { OnePrompt } from './one-prompt';

const HEADER_ROWS = 1;
const IMAGE_SHEET = SpreadsheetApp.getActive().getSheetByName('Images');
const SCALED_SHEET = SpreadsheetApp.getActive().getSheetByName('Scaled');
const CONFIG = Config.readConfig();

interface BackgroundDefinition {
  title?: string;
  description: string;
}

interface ImageQueue {
  folderId: string;
  outputFolderId: string;
  fileName: string;
  fileId: string;
  prompt: string;
  variationId: number;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function doGet() {
  return HtmlService.createTemplateFromFile('ui').evaluate();
}

function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BackgroundR on 🍌s')
    .addItem('🎨 Open configurator', 'showSidebar')
    .addItem('📥 Load images from Google Drive', 'getImagesFromDrive')
    .addItem('🧹 Clear generated images', 'clearGeneratedImages')
    .addToUi();
}

function clearGeneratedImages() {
  if (!IMAGE_SHEET) {
    throw `Sheet 'Images' not found`;
  }
  // First column: Image, Second: drive id
  IMAGE_SHEET.getDataRange().offset(HEADER_ROWS, 2).clearContent();
}

function getImagesFromDrive() {
  getImageAssets(CONFIG['Drive Folder Id']);
}

function showSidebar() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createTemplateFromFile('ui').evaluate().setTitle(' ')
  );
}

// Trigered from sidebar angular
function loadDropDowns() {
  const config = Config.readConfig();
  return OnePrompt.getDropdowns(config['Dropdowns sheet']);
}

// Trigered from sidebar angular
function generateImages(
  numberOfImages = 1,
  partsAsObject?: {
    [key: string]: string[];
  },
  scoringThreshold?: number,
  maxRegenerations?: number
) {
  console.log('generateImages', {
    numberOfImages,
    partsAsObject,
    scoringThreshold,
    maxRegenerations,
  });
  const prefix = CONFIG['Prompt Prefix'];
  const suffix = CONFIG['Prompt Suffix'];

  const prompt = partsAsObject
    ? OnePrompt.generatePrompt(partsAsObject, prefix, suffix)
    : OnePrompt.generatePromptForSheet(
        CONFIG['Dropdowns sheet'],
        prefix,
        suffix
      );
  //console.log({ prompt });

  const manyPrompts = new Array(numberOfImages).fill(prompt).map(p => ({
    description: p,
  }));
  //console.log({ manyPrompts });

  return processImageAssets(
    manyPrompts,
    CONFIG['Cloud Project Id'],
    '',
    CONFIG['Image Generation Model'],
    scoringThreshold,
    maxRegenerations
  );
}

const getImagesToProcess = () => {
  if (!SCALED_SHEET) {
    throw `Sheet 'Scaled' not found`;
  }

  const dataRange = SCALED_SHEET.getDataRange();
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
};

const getImageAssets = (folderId: string) => {
  if (!IMAGE_SHEET) {
    throw `Sheet 'Images' not found`;
  }
  IMAGE_SHEET.getDataRange().offset(HEADER_ROWS, 0).clearContent();

  listFiles(folderId)
    .filter((file: GoogleAppsScript.Drive.File) => file.getSize() < 10000000)
    .slice(0, 10) // Sample 10 images under 10 Mb.
    .forEach((file: GoogleAppsScript.Drive.File) => {
      const fileBlob = file.getBlob();
      const bytes = fileBlob.getBytes();
      const base64Data = Utilities.base64Encode(bytes);
      const dataUrl = `data:${file.getMimeType()};base64,${base64Data}`;
      const cellImage = SpreadsheetApp.newCellImage()
        .setSourceUrl(dataUrl)
        .build();
      const row = [cellImage, file.getId()];
      const sheetRow = IMAGE_SHEET.getLastRow() + 1;
      IMAGE_SHEET.getRange(sheetRow, 1, 1, row.length).setValues([row]);
      IMAGE_SHEET.setRowHeight(sheetRow, 256);
      IMAGE_SHEET.setColumnWidth(1, 256);
    });
};

const getScoringHeaders = () => {
  const sheet = SpreadsheetApp.getActive().getSheetByName(
    CONFIG['Scoring results sheet']
  );
  return sheet
    ?.getRange(1, 3, 1, sheet.getLastColumn() - 2)
    .getDisplayValues()[0];
};

class ScoringError extends Error {}
const scoreImage = (image: string) => {
  const headers = ['Score', ...(getScoringHeaders() || [])];
  const outputSpec =
    '## Ouput only JSON (no md or any additional formatting):\n' +
    '{' +
    headers?.map(h => `"${h}": "...",`).join('\n') +
    '}';
  const responseSchema = {
    type: 'object',
    properties: {
      ...Object.fromEntries(headers?.map(h => [h, { type: 'string' }]) || []),
    },
    required: ['Score'],
  };

  const geminiResponse = queryGemini(
    CONFIG['Image Scoring Prompt'], //+ '\n\n' + outputSpec,
    image,
    'image/png',
    CONFIG['Cloud Project Id'],
    CONFIG['Scoring Model'],
    responseSchema
  );
  console.log({ geminiResponse });

  try {
    const geminiResponseParsed = JSON.parse(
      geminiResponse.replaceAll('```json', '').replaceAll('```', '')
    );
    addToScoringSheet(image, geminiResponseParsed);
    console.log({ geminiResponseParsed });
    return parseInt(geminiResponseParsed['Score']?.trim());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log('Not able to parse JSON...');
    throw new ScoringError(e);
  }
};

const addToScoringSheet = (
  image: string,
  geminiResponseParsed: { [key: string]: string }
) => {
  console.log('addToScoringSheet', {
    image,
    geminiResponseParsed,
  });
  const img = SpreadsheetApp.newCellImage()
    .setSourceUrl(`data:image/png;base64,${image}`)
    .build();

  const sheet = SpreadsheetApp.getActive().getSheetByName(
    CONFIG['Scoring results sheet']
  );
  if (!sheet) {
    console.log('Scoring results sheet not found');
    return;
  }

  const headers = getScoringHeaders();
  const output = [
    '',
    geminiResponseParsed['Score'],
    ...Array(headers && headers?.length ? headers?.length : 0).fill(''),
  ];
  headers?.forEach((h, i) => {
    output[i + 2] = geminiResponseParsed[h];
  });

  const lastRow = sheet.getLastRow();
  sheet.appendRow(output);
  sheet.getRange(lastRow + 1, 1, 1, 1).setValue(img);
  sheet.setRowHeight(lastRow + 1, 256).setColumnWidth(1, 256);
};

const processImageAssets = (
  backgroundDefinitions: BackgroundDefinition[],
  projectId: string,
  region: string,
  modelId: string,
  scoringThreshold?: number,
  maxRegenerations?: number
) => {
  console.log({ CONFIG });
  console.log('processImageAssets', {
    backgroundDefinitions,
    projectId,
    region,
    modelId,
    scoringThreshold,
    maxRegenerations,
  });

  if (!IMAGE_SHEET) {
    throw `Sheet 'Images' not found`;
  }
  IMAGE_SHEET.getRange('B:B')
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
          const currentImage = IMAGE_SHEET.getRange(
            currentIndex + 1 + HEADER_ROWS,
            5 + bgIndex,
            1,
            1
          ).getValue();
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
              console.log(
                `Attempt ${attemptNumber + 1} to generate image for "${
                  e.description
                }"`
              );
              resultImageBase64 = queryGemini(
                e.description,
                base64Data,
                mimeType,
                CONFIG['Cloud Project Id'],
                CONFIG['Image Generation Model']
              );
              const imageScore = scoreImage(base64Data);
              console.log(`Image score: ${imageScore}`);

              const cell = IMAGE_SHEET.getRange(
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
              e.description,
              base64Data,
              mimeType,
              CONFIG['Cloud Project Id'],
              CONFIG['Image Generation Model']
            );
          }
          return SpreadsheetApp.newCellImage()
            .setSourceUrl(`data:image/png;base64,${resultImageBase64}`)
            .build();
        });
        variations.forEach((img, i) => {
          if (img) {
            IMAGE_SHEET.getRange(
              currentIndex + 1 + HEADER_ROWS,
              5 + i
            ).setValue(img);
          }
        });
        for (let i = 3; i < 5 + backgroundDefinitions.length; i++) {
          IMAGE_SHEET.setColumnWidth(i, 256);
        }
      } catch (e) {
        IMAGE_SHEET.getRange(currentIndex + 1, 1, 1, 1)
          .offset(HEADER_ROWS, 4)
          .setValue(`Error: ${e}`);
      }
    });
};

const setHeaders = (backgroundDefinitions: BackgroundDefinition[]) => {
  if (!IMAGE_SHEET) {
    throw `Sheet 'Images' not found`;
  }
  IMAGE_SHEET?.getRange('E1:Z1').clearContent();
  IMAGE_SHEET?.getRange(1, 5, 1, backgroundDefinitions.length).setValues([
    backgroundDefinitions.map(e => e.title),
  ]);
};

const addFolderToQueue = (
  folderName: string,
  backgroundDefinitions: BackgroundDefinition[]
) => {
  if (!SCALED_SHEET) {
    throw `Sheet 'Scaled' not found`;
  }
  SCALED_SHEET.appendRow([
    '',
    folderName,
    ...backgroundDefinitions.map(e => e.description),
  ]);
  SpreadsheetApp.getActive().setActiveSheet(SCALED_SHEET);
};

const getOAuthToken = () => {
  return ScriptApp.getOAuthToken();
};
