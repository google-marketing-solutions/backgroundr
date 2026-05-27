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
export class Config {
  /**
   * Reads configuration key-value pairs from a Google Sheet.
   *
   * @param sheetName The name of the sheet containing the config
   *   (default: 'Config').
   * @param configVariables Optional list of specific keys to retrieve. If
   *   omitted, all keys are retrieved.
   * @param onlyWithNonEmptyValues If true, excludes keys that have
   *   empty/falsy values.
   * @returns An object mapping configuration keys to their values.
   */

  static readConfig(
    sheetName = 'Config',
    configVariables?: string[],
    onlyWithNonEmptyValues = false
  ): Record<string, string> {
    if (typeof SpreadsheetApp === 'undefined') {
      return {};
    }

    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!activeSpreadsheet) {
      throw new Error('No active spreadsheet found.');
    }

    const sheet = activeSpreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found.`);
    }

    const range = sheet.getRange('A:B');
    const rows = range?.getDisplayValues();
    if (!rows || rows.length === 0) {
      throw new Error(`No configuration values found in sheet "${sheetName}".`);
    }

    const allowedKeys = configVariables ? new Set(configVariables) : null;

    const filteredRows = rows.filter(([key, value]) => {
      if (!key) {
        return false;
      }
      if (allowedKeys && !allowedKeys.has(key)) {
        return false;
      }
      if (onlyWithNonEmptyValues && !value) {
        return false;
      }
      return true;
    });

    return Object.fromEntries(filteredRows);
  }
}
