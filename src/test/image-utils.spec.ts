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

import {getImageResolution} from '../image-utils';

describe('Image Utilities', () => {
  const createMockBlob = (
    bytes: number[],
    mimeType: string
  ): GoogleAppsScript.Base.Blob => {
    return {
      getBytes: () => bytes,
      getContentType: () => mimeType,
    } as unknown as GoogleAppsScript.Base.Blob;
  };

  describe('getImageResolution', () => {
    it('should return null for unsupported MIME types', () => {
      const blob = createMockBlob([0, 1, 2, 3], 'image/gif');
      expect(getImageResolution(blob)).toBeNull();
    });
  });

  describe('getPngResolution', () => {
    it('should correctly extract PNG dimensions', () => {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      // IHDR chunk starts at offset 8
      // Width is 4 bytes at offset 16, Height is 4 bytes at offset 20
      const bytes = [
        -119,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // signature
        0,
        0,
        0,
        13,
        0x49,
        0x48,
        0x44,
        0x52, // length & type
        0,
        0,
        3,
        32, // width: 800
        0,
        0,
        2,
        88, // height: 600
        8,
        6,
        0,
        0,
        0,
        0,
        0,
        0,
      ];

      const blob = createMockBlob(bytes, 'image/png');
      expect(getImageResolution(blob)).toEqual({ width: 800, height: 600 });
    });

    it('should return null for PNG with invalid signature length', () => {
      const bytes = [-119, 0x50, 0x4e, 0x47];
      const blob = createMockBlob(bytes, 'image/png');
      expect(getImageResolution(blob)).toBeNull();
    });

    it('should return null for invalid PNG signature bytes', () => {
      const bytes = new Array(24).fill(0);
      const blob = createMockBlob(bytes, 'image/png');
      expect(getImageResolution(blob)).toBeNull();
    });
  });

  describe('getJpegResolution', () => {
    it('should correctly parse JPEG SOF0 dimensions', () => {
      // JPEG starts with SOI 0xFFD8 (-1, -40 signed)
      // SOF0 chunk structure:
      // Offset 0: 0xFF
      // Offset 1: marker type SOF0 (-64)
      // Offset 2: length (2 bytes) -> here length is 8
      // Offset 4: precision (1 byte)
      // Offset 5: height (2 bytes) -> 150 (0x0096)
      // Offset 7: width (2 bytes) -> 200 (0x00C8)
      const bytes = [
        -1,
        -40, // SOI
        -1,
        -64, // SOF0
        0,
        8, // length
        8, // precision
        0,
        150, // height
        0,
        200, // width
      ];

      const blob = createMockBlob(bytes, 'image/jpeg');
      expect(getImageResolution(blob)).toEqual({ width: 200, height: 150 });
    });

    it('should correctly parse JPEG SOF2 dimensions', () => {
      const bytes = [
        -1,
        -40,
        -1,
        -62, // SOF2
        0,
        8,
        8,
        0,
        100,
        1,
        44,
      ];

      const blob = createMockBlob(bytes, 'image/jpeg');
      expect(getImageResolution(blob)).toEqual({ width: 300, height: 100 });
    });

    it('should skip other markers and find SOF0/SOF2', () => {
      // APP0 segment (0xFFE0 -> -1, -32 signed)
      // length = 4 (precision + 2 bytes length)
      const bytes = [
        -1,
        -40, // SOI
        -1,
        -32, // APP0 marker
        0,
        4, // length of segment (4)
        0,
        0, // dummy data (2 bytes)
        -1,
        -64, // SOF0 marker
        0,
        8,
        8,
        0,
        90,
        0,
        120,
      ];

      const blob = createMockBlob(bytes, 'image/jpeg');
      expect(getImageResolution(blob)).toEqual({ width: 120, height: 90 });
    });

    it('should handle truncated or invalid segment length', () => {
      // Segment claims length 20, but file ends immediately
      const bytes = [-1, -40, -1, -32, 0, 20, 0, 0];

      const blob = createMockBlob(bytes, 'image/jpeg');
      expect(getImageResolution(blob)).toBeNull();
    });

    it('should return null if no SOF marker is present', () => {
      const bytes = [-1, -40, -1, -32, 0, 4, 0, 0];

      const blob = createMockBlob(bytes, 'image/jpeg');
      expect(getImageResolution(blob)).toBeNull();
    });
  });
});
