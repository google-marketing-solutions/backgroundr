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

export const listFiles = (folder: string) => {
  const files: GoogleAppsScript.Drive.File[] = [];
  const filesIterator = DriveApp.getFolderById(folder).getFiles();
  while (filesIterator.hasNext()) {
    const file = filesIterator.next();
    if (['image/jpeg', 'image/png'].includes(file.getMimeType())) {
      files.push(file);
    }
  }
  return files;
};

export const ensureFolderExists = (
  parentFolderId: string,
  newFolderName = 'output'
): string => {
  const parentFolder = getFolderById(parentFolderId);
  const outputFolderIterator = parentFolder.getFoldersByName(newFolderName);
  if (outputFolderIterator.hasNext()) {
    const outputFolder = outputFolderIterator.next();
    return outputFolder.getId();
  }
  const newFolder = parentFolder.createFolder(newFolderName);
  return newFolder.getId();
};

export const writeToDrive = (
  folderId: string,
  fileName: string,
  file: string,
  mimeType: string
) => {
  const bytes = Utilities.base64Decode(file);
  const blob = Utilities.newBlob(bytes, mimeType, `${fileName}.png`);
  getFolderById(folderId).createFile(blob);
};

export const getFileById = (id: string) => DriveApp.getFileById(id);
export const getFolderById = (id: string) => DriveApp.getFolderById(id);
