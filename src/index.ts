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

import { ensureFolderExists, getFileById, listFiles } from './drive-api';
import { getPredictionEndpoint, predict } from './vertex-ai';

const HEADER_ROWS = 1;
const IMAGE_SHEET = SpreadsheetApp.getActive().getSheetByName('Images');
const SCALED_SHEET = SpreadsheetApp.getActive().getSheetByName('Scaled');

interface BackgroundDefinition {
  title: string;
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

interface Config {
  driveFolderId: string;
  projectId: string;
  modelId: string;
  region: string;
  backgroundDefinitions: BackgroundDefinition[];
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
    .createMenu('BackgroundR')
    .addItem('Open', 'showSidebar')
    .addItem('Run scaled', 'getImagesToProcess')
    .addToUi();
}

function showSidebar() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createTemplateFromFile('ui').evaluate().setTitle(' ')
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

const processImageAssets = (
  backgroundDefinitions: BackgroundDefinition[],
  projectId: string,
  region: string,
  modelId: string,
  backgroundRemoval: boolean
) => {
  if (!IMAGE_SHEET) {
    throw `Sheet 'Images' not found`;
  }
  const imageGenerationEndpoint = getPredictionEndpoint(
    projectId,
    region,
    modelId
  );
  IMAGE_SHEET.getRange('B:B')
    .offset(HEADER_ROWS, 0)
    .getValues()
    .forEach(([id], currentIndex) => {
      if (!id) {
        return;
      }
      const file = getFileById(id);
      const fileBlob = file.getBlob();
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
          const result = predict(
            `${e.description}`,
            base64Data,
            imageGenerationEndpoint,
            modelId,
            backgroundRemoval
          );
          return SpreadsheetApp.newCellImage()
            .setSourceUrl(
              `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`
            )
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

const getConfig = (): Config => {
  const config = PropertiesService.getScriptProperties().getProperty('config');
  return config
    ? JSON.parse(config)
    : {
        driveFolderId: '',
        projectId: '',
        modelId: '',
        region: '',
        backgroundDefinitions: [],
      };
};

const setConfig = (config: Config) => {
  PropertiesService.getScriptProperties().setProperty(
    'config',
    JSON.stringify(config)
  );
};
