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
  if (!modelId || modelId.startsWith('gemini')) {
    return (
      `https://aiplatform.googleapis.com/v1/publishers/google/models` +
      `/${modelId}:generateContent`
    );
  }
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:predict`;
};

export const getPredictionBody = (
  prompt: string,
  image: string,
  modelId: string,
  backgroundRemoval: boolean,
  mimeType = 'image/jpeg'
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions => {
  if (!modelId || modelId.startsWith('gemini')) {
    console.log('getPredictionBody:Gemini was selected');
    const body = createRequestOptions({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: image,
              },
            },
          ],
        },
      ],
    });

    console.log('Request body:', JSON.stringify(body, null, 2));
    return body;
  } else if (modelId.startsWith('imagegeneration@')) {
    return createRequestOptions({
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
    });
  } else if (modelId.startsWith('imagen-3.0')) {
    if (backgroundRemoval) {
      return createRequestOptions({
        instances: [
          {
            prompt,
            referenceImages: [
              {
                referenceType: 'REFERENCE_TYPE_RAW',
                referenceId: 1,
                referenceImage: {
                  bytesBase64Encoded: image,
                },
              },
              {
                referenceType: 'REFERENCE_TYPE_MASK',
                referenceId: 2,
                maskImageConfig: {
                  maskMode: 'MASK_MODE_BACKGROUND',
                  dilation: 0.0,
                },
              },
            ],
          },
        ],
        parameters: {
          negativePrompt: '',
          promptLanguage: 'en',
          editConfig: {
            baseSteps: 75,
          },
          editMode: 'EDIT_MODE_BGSWAP',
          sampleCount: 1,
          safetySetting: 'block_only_high',
          personGeneration: 'allow_adult',
        },
      });
    } else {
      return createRequestOptions({
        instances: [
          {
            prompt,
            referenceImages: [
              {
                referenceType: 'REFERENCE_TYPE_RAW',
                referenceId: 1,
                referenceImage: {
                  bytesBase64Encoded: image,
                },
              },
            ],
          },
        ],
        parameters: {
          safetySetting: 'block_only_high',
          personGeneration: 'allow_adult',
          sampleCount: 1,
          promptLanguage: 'en',
        },
      });
    }
  } else throw Error(`Unsupported model: ${modelId}`);
};

export const predict = (
  prompt: string,
  image: string,
  predictionEndpoint: string,
  modelId: string,
  backgroundRemoval: boolean,
  mimeType?: string
): PredictionResponse => {
  // respect rate limitations
  Utilities.sleep(1000);
  console.log(`Prompt: ${prompt}`);
  const res = fetchJson<PredictionResponse>(
    predictionEndpoint,
    getPredictionBody(prompt, image, modelId, backgroundRemoval, mimeType)
  );
  console.log('API Response:', JSON.stringify(res, null, 2));
  return res;
};
