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
import { getFileById } from './drive-api';
import { PromptPart } from './gemini';

export class OnePrompt {
  static generatePromptForSheet(
    sheetName: string,
    promptPrefix = '',
    promptSuffix = '',
    ingredientsAsObject?: { [key: string]: string | null }
  ): PromptPart[] {
    const partsAsObject = OnePrompt.getDropdowns(sheetName);
    return OnePrompt.generatePrompt(
      partsAsObject,
      promptPrefix,
      promptSuffix,
      ingredientsAsObject
    );
  }

  static generatePrompt(
    partsAsObject: { [key: string]: string | null | string[] },
    promptPrefix = '',
    promptSuffix = '',
    ingredientsAsObject?: { [key: string]: string | null }
  ): PromptPart[] {
    const textPrompt = OnePrompt.generateTextPrompt(
      partsAsObject,
      promptPrefix,
      promptSuffix
    );

    const promptParts: PromptPart[] = [{ type: 'text', value: textPrompt }];

    if (ingredientsAsObject) {
      for (const [name, fileId] of Object.entries(ingredientsAsObject)) {
        if (fileId) {
          const file = getFileById(fileId);
          const blob = file.getBlob();
          const base64Data = Utilities.base64Encode(blob.getBytes());
          promptParts.push({
            type: 'text',
            value: `Use only the following ${name}`,
          });
          promptParts.push({
            type: 'image',
            value: base64Data,
            mimeType: blob.getContentType() ?? undefined,
          });
        }
      }
    }

    return promptParts;
  }

  static generateTextPrompt(
    partsAsObject: { [key: string]: string | null | string[] },
    promptPrefix = '',
    promptSuffix = ''
  ) {
    const promptParts = OnePrompt.generateTextPromptParts(partsAsObject);
    return (
      (promptPrefix ? promptPrefix + '\n\n' : '') +
      promptParts.join('\n\n') +
      (promptSuffix ? '\n\n' + promptSuffix : '')
    );
  }

  static generateTextPromptParts(partsAsObject: {
    [key: string]: string | null | string[];
  }) {
    const promptParts: string[] = [];
    for (const partType in partsAsObject) {
      const partValue = partsAsObject[partType];
      if (partValue) {
        if (partValue instanceof Array) {
          const promptForPart =
            `### ${partType}:\n` + partValue.map(p => `* ${p}`).join('\n');
          promptParts.push(promptForPart);
        } else {
          const promptForPart = `### ${partType}:\n* ${partValue}`;
          promptParts.push(promptForPart);
        }
      }
    }
    return promptParts;
  }

  static getDropdowns(sheetName: string) {
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

    const partsAsObject: { [key: string]: string[] } = {};
    const headers = parts.shift();

    parts.forEach(part => {
      part.forEach((p, i) => {
        if (p && p.length) {
          if (headers && headers[i]) {
            if (!(headers[i] in partsAsObject)) {
              partsAsObject[headers[i]] = [];
            }
            partsAsObject[headers[i]].push(p);
          }
        }
      });
    });

    return partsAsObject;
  }
}
