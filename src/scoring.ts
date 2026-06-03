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
import {queryGemini} from './gemini';

/**
 * Custom error class for image scoring failures.
 */
export class ScoringError extends Error {}

/**
 * Reads headers to evaluate for scoring from the configured spreadsheet.
 *
 * @returns An array of target score header names.
 */
export function getScoringHeaders(): string[] | undefined {
  const config = Config.readConfig();
  const sheet = SpreadsheetApp.getActive().getSheetByName(
    config['Scoring results sheet']
  );
  return sheet
    ?.getRange(1, 3, 1, sheet.getLastColumn() - 2)
    .getDisplayValues()[0];
}

/**
 * Appends generated base64 image details and its scores to the scoring sheet.
 *
 * @param image Base64 encoded image content.
 * @param geminiResponseParsed JSON properties returned by Gemini model.
 */
export function addToScoringSheet(
  image: string,
  geminiResponseParsed: {[key: string]: string}
): void {
  console.log('addToScoringSheet', {
    image,
    geminiResponseParsed,
  });
  const config = Config.readConfig();
  const img = SpreadsheetApp.newCellImage()
    .setSourceUrl(`data:image/png;base64,${image}`)
    .build();

  const sheet = SpreadsheetApp.getActive().getSheetByName(
    config['Scoring results sheet']
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
}

/**
 * Calls Gemini to evaluate the generated image asset against target criteria.
 *
 * @param image Base64 encoded image string.
 * @returns The parsed numeric score of the image (0-10).
 * @throws {ScoringError} if evaluation or parsing fails.
 */
export function scoreImage(image: string): number {
  const config = Config.readConfig();
  const headers = ['Score', ...(getScoringHeaders() || [])];
  const responseSchema = {
    type: 'object',
    properties: {
      ...Object.fromEntries(headers?.map(h => [h, {type: 'string'}]) || []),
    },
    required: ['Score'],
  };

  const geminiResponse = queryGemini(
    [
      {type: 'text', value: config['Image Scoring Prompt']},
      {type: 'image', value: image, mimeType: 'image/png'},
    ],
    config['Cloud Project Id'],
    config['Scoring Model'],
    responseSchema,
    undefined,
    config['GCP Location']
  );
  console.log({geminiResponse});

  try {
    const geminiResponseParsed = JSON.parse(
      geminiResponse.replace(/```json/g, '').replace(/```/g, '')
    );
    addToScoringSheet(image, geminiResponseParsed);
    console.log({geminiResponseParsed});
    return parseInt(geminiResponseParsed['Score']?.trim());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log('Not able to parse JSON...');
    throw new ScoringError(e);
  }
}
