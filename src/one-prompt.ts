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

import { getFileById } from './drive-api';
import { PromptPart } from './gemini';
import { DropdownsSheetReader } from './dropdowns-sheet-reader';

/**
 * A mapping of ingredient names to their Google Drive file IDs.
 */
export type IngredientMap = Record<string, string | null>;

/**
 * A mapping of prompt components to their values or arrays of values.
 */
export type PromptDropdownMap = Record<string, string | null | string[]>;

/**
 * Helper class for generating structured Gemini prompt parts from Spreadsheet.
 */
export class OnePrompt {
  /**
   * Generates Gemini prompt parts from dropdowns for all provided options in
   * the specified sheet.
   *
   * @param sheetName The sheet containing dropdown components.
   * @param promptPrefix Text to prepend to the final prompt.
   * @param promptSuffix Text to append to the final prompt.
   * @param ingredientsAsObject Optional ingredient names mapped to drive IDs.
   * @returns An array of Gemini API ready prompt parts.
   */
  static generatePromptForSheet(
    sheetName: string,
    promptPrefix = '',
    promptSuffix = '',
    ingredientsAsObject?: IngredientMap
  ): PromptPart[] {
    const partsAsObject = DropdownsSheetReader.getDropdowns(sheetName);
    return OnePrompt.generatePrompt(
      partsAsObject,
      promptPrefix,
      promptSuffix,
      ingredientsAsObject
    );
  }

  /**
   * Creates Gemini multimodal prompt parts from structured text and images.
   *
   * @param partsAsObject Text dropdown options to compile.
   * @param promptPrefix Optional prepended prompt text.
   * @param promptSuffix Optional appended prompt text.
   * @param ingredientsAsObject Optional base64 image parameters to attach.
   * @returns Combined structured prompt parts.
   */
  static generatePrompt(
    partsAsObject: PromptDropdownMap,
    promptPrefix = '',
    promptSuffix = '',
    ingredientsAsObject?: IngredientMap
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

  /**
   * Concatenates and builds the final raw prompt string from dropdown maps.
   *
   * @param partsAsObject Structured prompt sections.
   * @param promptPrefix Optional prepended prompt text.
   * @param promptSuffix Optional appended prompt text.
   * @returns Compounded prompt string.
   */
  static generateTextPrompt(
    partsAsObject: PromptDropdownMap,
    promptPrefix = '',
    promptSuffix = ''
  ): string {
    const promptParts = OnePrompt.generateTextPromptParts(partsAsObject);
    return (
      (promptPrefix ? promptPrefix + '\n\n' : '') +
      promptParts.join('\n\n') +
      (promptSuffix ? '\n\n' + promptSuffix : '')
    );
  }

  /**
   * Formats lists and standalone items in markdown structures.
   *
   * @param partsAsObject Dropdown map sections.
   * @returns Individual formatted prompt block strings.
   */
  static generateTextPromptParts(partsAsObject: PromptDropdownMap): string[] {
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
}
