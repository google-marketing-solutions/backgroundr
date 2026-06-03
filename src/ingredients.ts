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
import {listFiles} from './drive-api';

/**
 * Loads ingredient asset definitions and maps them to their thumbnail preview URLs and Drive IDs.
 *
 * @returns Ingredients map grouping thumbnail files by ingredient categories.
 */
export function loadIngredients(): {
  [key: string]: {name: string; thumbnail: string; fileId: string}[];
} {
  const config = Config.readConfig();
  const sheetName = config['Ingredients sheet'];
  if (!SpreadsheetApp?.getActiveSpreadsheet()?.getSheetByName(sheetName)) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  const parts = SpreadsheetApp?.getActiveSpreadsheet()
    ?.getSheetByName(sheetName)
    ?.getDataRange()
    ?.getDisplayValues();
  if (!parts || !parts.length) {
    return {};
  }

  const ingredientsAsObject: {
    [key: string]: {name: string; thumbnail: string; fileId: string}[];
  } = {};
  parts.shift(); // Remove header row

  parts.forEach(part => {
    const name = part[0];
    const driveFolderId = part[1];
    if (name && driveFolderId) {
      const files = listFiles(driveFolderId).map(
        (f: GoogleAppsScript.Drive.File) => {
          try {
            const blob = f.getBlob();
            if (blob) {
              const blobBase64 = Utilities.base64Encode(blob.getBytes());
              return {
                fileId: f.getId(),
                name: f.getName(),
                thumbnail: `data:${blob.getContentType()};base64,${blobBase64}`,
              };
            } else {
              return {
                fileId: f.getId(),
                name: f.getName(),
                thumbnail: '',
              };
            }
          } catch (e) {
            console.error(
              `Error generating thumbnail for file: ${f.getName()}`,
              e
            );
            return {
              fileId: f.getId(),
              name: f.getName(),
              thumbnail: '',
            };
          }
        }
      );
      ingredientsAsObject[name] = files;
    }
  });

  return ingredientsAsObject;
}
