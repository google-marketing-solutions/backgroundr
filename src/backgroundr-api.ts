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
export interface BackgroundrSeparateResponse {
  input: string;
  mask: string;
  foreground: string;
}

export interface BackgroundrVariateResponse {
  variants: string[];
}

export class BackgroundrClient {
  readonly base64Prefixes: Record<string, string | undefined> = {
    'png': 'data:image/png;base64,',
    'jpg': 'data:image/jpg;base64,',
    'jpeg': 'data:image/jpg;base64,',
    'gif': 'data:image/gif;base64,',
    '': undefined,
  };

  constructor(readonly baseUrl: string) {}

  protected sendRequest(
    path: string,
    opts: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
  ) {
    opts.headers = opts.headers || {};
    if (opts.payload && typeof opts.payload !== 'string') {
      opts.payload = JSON.stringify(opts.payload);
    }
    opts.headers = {
      ...opts.headers!,
      'Authorization': `Bearer ${ScriptApp.getIdentityToken()}`,
      'Content-Type': 'application/json',
    };
    return UrlFetchApp.fetch(`${this.baseUrl}/${path}`, opts);
  }

  convertBlobToBase64(blob: GoogleAppsScript.Base.Blob) {
    const name = blob.getName();
    const extension = name?.split('.').slice(-1)[0];
    const prefix = this.base64Prefixes[extension ?? ''];
    if (!prefix) {
      throw new Error(`Unsupported image format '${extension}'`);
    }
    const base64 = Utilities.base64Encode(blob.getBytes());
    return prefix + base64;
  }

  separate(image: GoogleAppsScript.Base.Blob) {
    const response = this.sendRequest('separate', {
      method: 'post',
      payload: { image: this.convertBlobToBase64(image) },
    });
    return JSON.parse(response.getContentText()) as BackgroundrSeparateResponse;
  }

  register(image: GoogleAppsScript.Base.Blob, token?: string) {
    return this.sendRequest('register', {
      method: 'post',
      payload: { image: this.convertBlobToBase64(image), token },
    });
  }

  variate(image: string, mask: string, prompt: string) {
    const response = this.sendRequest('variate', {
      method: 'post',
      payload: {
        image,
        mask,
        prompt,
      },
    });
    return JSON.parse(response.getContentText()) as BackgroundrVariateResponse;
  }
}
