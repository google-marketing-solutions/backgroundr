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

export function getImageResolution(
  blob: GoogleAppsScript.Base.Blob
): { width: number; height: number } | null {
  const bytes = blob.getBytes();
  const mimeType = blob.getContentType();

  if (mimeType === 'image/png') {
    return getPngResolution(bytes);
  } else if (mimeType === 'image/jpeg') {
    return getJpegResolution(bytes);
  }
  return null;
}

function getPngResolution(
  bytes: number[]
): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length < 24 ||
    bytes[0] !== -119 || // 0x89 signed byte is -119
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  // IHDR chunk starts at offset 8
  // Width is 4 bytes at offset 16
  // Height is 4 bytes at offset 20
  const width = readInt32(bytes, 16);
  const height = readInt32(bytes, 20);

  return { width, height };
}

function getJpegResolution(
  bytes: number[]
): { width: number; height: number } | null {
  let i = 2;
  while (i < bytes.length) {
    // 0xFF start of marker
    if (bytes[i] !== -1) {
      // 0xFF signed is -1
      i++;
      continue;
    }

    const marker = bytes[i + 1];
    // potentially valid markers: SOF0 (0xC0), SOF2 (0xC2)
    // 0xC0 = -64, 0xC2 = -62
    if (marker === -64 || marker === -62) {
      const height = readInt16(bytes, i + 5);
      const width = readInt16(bytes, i + 7);
      return { width, height };
    }

    // Move to next marker
    const length = readInt16(bytes, i + 2);
    i += length + 2;
  }
  return null;
}

function readInt32(bytes: number[], offset: number): number {
  return (
    ((bytes[offset] & 0xff) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff)
  );
}

function readInt16(bytes: number[], offset: number): number {
  return ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
}
