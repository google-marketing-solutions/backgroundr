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
export interface Prediction {
  mimeType: string;
  bytesBase64Encoded: string;
}
export interface PredictionResponse {
  predictions: Prediction[];
}
const baseParams: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
  method: 'post',
  muteHttpExceptions: true,
  contentType: 'application/json',
  headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
};
const createRequestOptions = (payload: unknown) =>
  Object.assign({ payload: JSON.stringify(payload) }, baseParams);
const fetchJson = <T>(
  url: string,
  params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
) => JSON.parse(UrlFetchApp.fetch(url, params).getContentText()) as T;

export const getPredictionEndpoint = (
  projectId: string,
  region: string,
  modelId: string
): string => {
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:predict`;
};

export const predict = (
  prompt: string,
  image: string,
  predictionEndpoint: string
): PredictionResponse => {
  Utilities.sleep(1000);
  // respect rate limitations
  console.log(`Prompt: ${prompt}`);
  const res = fetchJson<PredictionResponse>(
    predictionEndpoint,
    createRequestOptions({
      instances: [
        {
          prompt,
          image: {
            bytesBase64Encoded: image,
          },
        },
      ],
      parameters: {
        sampleCount: 1,
        editConfig: {
          editMode: 'product-image',
        },
      },
    })
  );
  console.log(JSON.stringify(res, null, 2));
  return res;
};
