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
 * Represents the response returned by the Vertex AI Image Generation API.
 */
interface VisionApiResponse {
  predictions: [
    {
      bytesBase64Encoded: string;
    },
  ];
}

/**
 * Represents a single part of a request payload sent to the Gemini API.
 */
interface GeminiRequest {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
  fileData?: {
    fileUri: string;
    mimeType: string;
  };
}

/**
 * Represents the parsed structure of a Gemini API text generation response.
 */
interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
}

/**
 * Represents the full request payload structure sent to Gemini.
 */
interface GeminiRequestPayload {
  contents: Array<{ role: string; parts: GeminiRequest[] }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseModalities: string[];
    topK: number;
    topP: number;
    imageConfig?: {
      aspectRatio: string;
      imageSize: string;
      imageOutputOptions: { mimeType: string };
      personGeneration: string;
    };
    responseSchema?: Record<string, unknown>;
    responseMimeType?: string;
  };
  safetySettings: Array<{ category: string; threshold: string }>;
}

/**
 * Custom error class for Gemini API call failures.
 */
export class GeminiApiCallError extends Error {}

/**
 * Custom error class for image generation API call failures.
 */
export class ImageGenerationApiCallError extends Error {}

/**
 * Custom error class for JSON parsing errors.
 */
export class JsonParseError extends Error {}

/**
 * Main interface for the VertexAI api
 */
export class VertexAiApi {
  /**
   * Default options for UrlFetchApp.fetch(...) with the auth token
   */
  private readonly baseOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions =
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      },
    };

  /**
   * Limit on the image generation api side
   */
  readonly IMAGE_GENERATION_API_LIMIT = 4;

  /**
   * The model name used for image generation requests.
   */
  private readonly imageGenerationModel = 'imagegeneration';

  /**
   * Creates a new client for interacting with Google Cloud's Vertex AI.
   *
   * @param projectId Your Google Cloud Project ID (Required).
   * @param region The region where resources are located.
   * @param apiEndpoint The base API endpoint for Gemini.
   * @param geminiModel The Gemini model for text generation.
   * @param imageAspectRatio The aspect ratio for image generation.
   * @param maxRetries Optional maximum number of retries on rate limit
   *   (default 3).
   * @param retryDelayMs Optional initial delay in milliseconds for backoff
   *   (default 1000).
   */
  constructor(
    private projectId: string,
    private region: string,
    private apiEndpoint: string,
    private geminiModel: string,
    private imageAspectRatio?: string,
    private maxRetries = 3,
    private retryDelayMs = 1000
  ) {}

  /**
   * Constructs the API endpoint URL for the specified Gemini model.
   *
   * @protected
   * @param model The name of the Gen AI model.
   * @param suffix The model suffix (e.g., 'generateContent', 'predict').
   * @returns The complete API endpoint URL.
   */
  protected getEndpoint(model: string, suffix: string) {
    const region = this.region || 'global';
    const url =
      `https://${this.apiEndpoint}/v1/projects/` +
      `${this.projectId}/locations/${region}/publishers/google/models/` +
      `${model}:${suffix}`;
    return url;
  }

  /**
   * Returns the specific API endpoint URL for the Gemini text model.
   *
   * @returns The Gemini API endpoint URL.
   * @protected
   */
  protected getGeminiEndpoint() {
    return this.getEndpoint(this.geminiModel, 'generateContent');
  }

  /**
   * Returns the specific API endpoint URL for the Vertex AI image model.
   *
   * @returns The image generation API endpoint URL.
   * @protected
   */
  protected getImageGenerationEndpoint() {
    return this.getEndpoint(this.imageGenerationModel, 'predict');
  }

  /**
   * Calls the Google Cloud Vertex AI API to generate images.
   *
   * @param prompt The text prompt describing the desired image.
   * @param sampleCount Optional number of image samples to
   *   generate (default 4).
   * @returns An array of base64-encoded image strings.
   * @throws {ImageGenerationApiCallError} If API call fails.
   * @throws {JsonParseError} If JSON parsing fails.
   */
  callImageGenerationApi(prompt: string, sampleCount = 4) {
    const options = { ...this.baseOptions };
    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount,
      },
    };
    options.payload = JSON.stringify(payload);
    const result = UrlFetchApp.fetch(
      this.getImageGenerationEndpoint(),
      options
    );
    if (result.getResponseCode() !== 200) {
      console.error(
        'Call to image generation API failed',
        result.getAllHeaders(),
        result.getContentText()
      );
      throw new ImageGenerationApiCallError(result.getContentText());
    }

    const resultParsed: VisionApiResponse = JSON.parse(
      result.getContentText('UTF-8')
    );
    return resultParsed.predictions?.map(e => e.bytesBase64Encoded);
  }

  /**
   * Calls the Gemini API to generate text responses.
   *
   * @param promptParts The array of text or image parts for prompt context.
   * @param json Whether to retrieve the prompt text as JSON strings.
   * @param responseSchema The optional schema for structured output.
   * @returns Generated text response from the Gemini model.
   * @throws {GeminiApiCallError} If the API call fails.
   * @throws {JsonParseError} If parsing the JSON response fails.
   */
  callGeminiApi(promptParts: PromptPart[], json = false, responseSchema = {}) {
    const options = { ...this.baseOptions };

    const parts: GeminiRequest[] = [];
    for (const part of promptParts) {
      if (part.type === 'text') {
        parts.push({ text: part.value });
      } else if (part.type === 'image') {
        parts.push({
          inlineData: {
            data: part.value,
            mimeType: part.mimeType || 'image/jpeg',
          },
        });
      }
    }

    const payload: GeminiRequestPayload = {
      contents: [
        {
          role: 'user',
          parts: parts,
        },
      ],
      generationConfig: {
        temperature: 1,
        maxOutputTokens: 32768,
        responseModalities: this.geminiModel.includes('image')
          ? ['TEXT', 'IMAGE']
          : ['TEXT'],
        topK: 40,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'OFF',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'OFF',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'OFF',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'OFF',
        },
      ],
    };

    if (this.geminiModel.includes('image') && this.imageAspectRatio) {
      payload.generationConfig.imageConfig = {
        aspectRatio: this.imageAspectRatio,
        imageSize: '1K',
        imageOutputOptions: {
          mimeType: 'image/png',
        },
        personGeneration: 'ALLOW_ALL',
      };
    }

    if (!this.geminiModel.includes('image') && responseSchema) {
      payload.generationConfig.responseSchema = responseSchema;
      payload.generationConfig.responseMimeType = 'application/json';
    }

    options.payload = JSON.stringify(payload);
    let retries = this.maxRetries;
    let delay = this.retryDelayMs;
    let result = UrlFetchApp.fetch(this.getGeminiEndpoint(), options);

    while (result.getResponseCode() !== 200) {
      const contentText = result.getContentText();
      const isRateLimited =
        result.getResponseCode() === 429 ||
        contentText.includes('RESOURCE_EXHAUSTED');

      if (isRateLimited && retries > 0) {
        retries--;
        // Sleep with exponential backoff + random jitter between 0 and 500ms
        const jitter = Math.floor(Math.random() * 500);
        Utilities.sleep(delay + jitter);
        delay *= 2;
        result = UrlFetchApp.fetch(this.getGeminiEndpoint(), options);
        continue;
      }

      console.error(
        'Call to Gemini API failed',
        result.getAllHeaders(),
        contentText
      );
      throw new GeminiApiCallError(contentText);
    }

    let resultParsed: GeminiApiResponse;
    try {
      resultParsed = JSON.parse(result.getContentText('UTF-8'));
    } catch (e) {
      console.error(
        'JSON parse error for Gemini output',
        result.getContentText('UTF-8'),
        e
      );
      throw new JsonParseError(result.getContentText('UTF-8'));
    }

    let geminiResponse = '';
    if (!json) {
      geminiResponse =
        resultParsed.candidates
          ?.map(
            candidate =>
              candidate.content?.parts
                ?.map(part => part.inlineData?.data || '')
                .join('') || ''
          )
          .join('') || '';
    } else {
      geminiResponse =
        resultParsed.candidates
          ?.map(
            candidate =>
              candidate.content?.parts?.map(part => part.text || '').join('') ||
              ''
          )
          .join('') || '';
    }

    return geminiResponse;
  }
}

/**
 * Represents a single part of a prompt (either text content or image data).
 */
export interface PromptPart {
  type: 'text' | 'image';
  /**
   * The content value: string for text, base64-encoded string for image.
   */
  value: string;
  /**
   * The image mime type (e.g., 'image/png'). Required only for image parts.
   */
  mimeType?: string;
}

/**
 * Helper function to quickly initialize VertexAiApi and send a query to Gemini.
 *
 * @param promptParts The array of prompt parts (text or images).
 * @param gcpProjectId The GCP Project ID.
 * @param modelId The Gemini model ID to use.
 * @param responseSchema Optional schema for structured JSON outputs.
 * @param imageAspectRatio Optional aspect ratio for generated images.
 * @param region Optional GCP region where Vertex AI is located.
 * @returns The generated text response from the model.
 */
export function queryGemini(
  promptParts: PromptPart[],
  gcpProjectId: string,
  modelId: string,
  responseSchema = {},
  imageAspectRatio?: string,
  region?: string
) {
  return new VertexAiApi(
    gcpProjectId,
    region || 'global',
    'aiplatform.googleapis.com',
    modelId,
    imageAspectRatio
  ).callGeminiApi(promptParts, !modelId.includes('image'), responseSchema);
}
