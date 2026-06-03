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

/**
 * Utility class to parse structured data options from a Google Spreadsheet.
 */
export class DropdownsSheetReader {
  /**
   * Reads the structured values from a sheet representing dropdown maps.
   *
   * @param sheetName Target spreadsheet sheet.
   * @returns Aggregated columns mapped by header names.
   */
  static getDropdowns(sheetName: string): Record<string, string[]> {
    const spreadsheet = SpreadsheetApp?.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('No active spreadsheet found');
    }
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const parts = sheet.getDataRange()?.getDisplayValues();
    if (!parts || !parts.length) {
      return {};
    }

    const partsAsObject: Record<string, string[]> = {};
    const headers = parts.shift();
    if (!headers) {
      return {};
    }

    parts.forEach(part => {
      part.forEach((p, i) => {
        if (p && p.length && headers[i]) {
          const headerName = headers[i];
          if (!(headerName in partsAsObject)) {
            partsAsObject[headerName] = [];
          }
          partsAsObject[headerName].push(p);
        }
      });
    });

    return partsAsObject;
  }

  /**
   * Builds standard UI title/item maps representing elements menu structures.
   *
   * @param sheetName Target spreadsheet sheet.
   * @returns Extracted elements categories list.
   */
  static getElementsMenu(
    sheetName: string
  ): {title: string; items: string[]}[] {
    const spreadsheet = SpreadsheetApp?.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('No active spreadsheet found');
    }
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();

    if (!lastColumn || !lastRow || lastColumn < 2) {
      return [];
    }

    // Get all data starting from column B (index 2)
    const data = sheet
      .getRange(1, 2, lastRow, lastColumn - 1)
      .getDisplayValues();
    if (!data || !data.length) {
      return [];
    }

    const headers = data[0];
    const menus: {title: string; items: string[]}[] = [];

    headers.forEach((title, index) => {
      if (title) {
        const items = data
          .slice(1) // Skip header row
          .map(row => row[index])
          .filter(item => item && item !== ''); // Filter empty cells

        menus.push({
          title: title,
          items: items,
        });
      }
    });

    return menus;
  }
}
