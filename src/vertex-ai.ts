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
) => {
  const content = UrlFetchApp.fetch(url, params).getContentText();
  return JSON.parse(content) as T;
};

export const getPredictionEndpoint = (
  projectId: string,
  region: string,
  modelId: string
): string => {
  const action = modelId === 'gemini-2.5-flash-image' ? 'generateContent' : 'predict';
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:${action}`;
};

export const getPredictionBody = (
  prompt: string,
  image: string,
  mimeType: string,
  modelId: string,
  backgroundRemoval: boolean
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions => {
  if (modelId === 'gemini-2.5-flash-image') {
    const enhancedPrompt = `You are a precise product image editor. Your task is to modify the background of the provided image to match this description: "${prompt}". CRITICAL INSTRUCTION: You MUST NOT modify, remove, or alter the main product/subject shown in the image in any way. The product itself must remain 100% identical to the original in terms of shape, color, orientation, and scale. Do NOT flip the product horizontally or vertically. Do NOT resize or scale down the product. Only modify the background around the product. Do not add any new text, logos, or unrelated elements. Failure to preserve the product perfectly is unacceptable.`;
    return createRequestOptions({
      "contents": [{
        "role": "user",
        "parts": [
          { "text": enhancedPrompt },
          { "inline_data": { "mime_type": mimeType, "data": image } }
        ]
      }]
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
  mimeType: string,
  predictionEndpoint: string,
  modelId: string,
  backgroundRemoval: boolean
): PredictionResponse => {
  // respect rate limitations
  Utilities.sleep(1000);
  console.log(`Prompt: ${prompt}`);
  const res = fetchJson<any>(
    predictionEndpoint,
    getPredictionBody(prompt, image, mimeType, modelId, backgroundRemoval)
  );
  console.log(JSON.stringify(res, null, 2));
  
  if (modelId === 'gemini-2.5-flash-image') {
    const parts = res.candidates?.[0]?.content?.parts;
    if (parts) {
      const imagePart = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
      if (imagePart) {
        const data = imagePart.inlineData?.data || imagePart.inline_data?.data;
        const mimeType = imagePart.inlineData?.mimeType || imagePart.inline_data?.mime_type || 'image/png';
        return {
          predictions: [{
            bytesBase64Encoded: data,
            mimeType: mimeType
          }]
        };
      }
    }
  }
  return res;
};
