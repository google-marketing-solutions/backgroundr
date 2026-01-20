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
export class OnePrompt {
  static generatePromptForSheet(
    sheetName: string,
    promptPrefix = '',
    promptSuffix = ''
  ) {
    const partsAsObject = OnePrompt.getDropdowns(sheetName);
    return OnePrompt.generatePrompt(partsAsObject, promptPrefix, promptSuffix);
  }

  static generatePrompt(
    partsAsObject: { [key: string]: string[] },
    promptPrefix = '',
    promptSuffix = ''
  ) {
    const promptParts = OnePrompt.generatePromptParts(partsAsObject);
    return (
      (promptPrefix ? promptPrefix + '\n\n' : '') +
      promptParts.join('\n\n') +
      (promptSuffix ? '\n\n' + promptSuffix : '')
    );
  }

  static generatePromptParts(partsAsObject: { [key: string]: string[] }) {
    const promptParts: string[] = [];
    for (const partType in partsAsObject) {
      const promptForPart =
        `### ${partType}:\n` +
        (partsAsObject[partType] instanceof Array
          ? partsAsObject[partType].map(p => `* ${p}`).join('\n')
          : `* ${partsAsObject[partType]}`);

      promptParts.push(promptForPart);
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
