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

import {PromptPart, VertexAiApi, queryGemini} from '../gemini';

describe('VertexAiApi', () => {
  let api: VertexAiApi;

  beforeEach(() => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).ScriptApp = {
      getOAuthToken: jest.fn().mockReturnValue('mock-oauth-token'),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Utilities = {
      sleep: jest.fn(),
    };

    api = new VertexAiApi(
      'mock-project',
      'us-central1',
      'aiplatform.googleapis.com',
      'mocked-model',
      '1:1'
    );
  });

  describe('callImageGenerationApi', () => {
    const mockUrlFetchApp = (responseCode: number, content: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).UrlFetchApp = {
        fetch: jest.fn().mockReturnValue({
          getResponseCode: () => responseCode,
          getContentText: () => content,
          getAllHeaders: () => ({}),
        }),
      };
    };

    it('should return base64 image strings on success', () => {
      const mockResponse = {
        predictions: [
          { bytesBase64Encoded: 'image-bytes-1' },
          { bytesBase64Encoded: 'image-bytes-2' },
        ],
      };
      mockUrlFetchApp(200, JSON.stringify(mockResponse));

      const result = api.callImageGenerationApi(
        'Generate a cool background',
        2
      );

      expect(result).toEqual(['image-bytes-1', 'image-bytes-2']);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global as any).UrlFetchApp.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'publishers/google/models/imagegeneration:predict'
        ),
        expect.objectContaining({
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            instances: [{ prompt: 'Generate a cool background' }],
            parameters: { sampleCount: 2 },
          }),
        })
      );
    });

    it('should throw ImageGenerationApiCallError on non-200 status', () => {
      mockUrlFetchApp(500, 'Internal Server Error');

      expect(() => api.callImageGenerationApi('prompt')).toThrow(
        'Internal Server Error'
      );
    });
  });

  describe('callGeminiApi', () => {
    const mockUrlFetchApp = (responseCode: number, content: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).UrlFetchApp = {
        fetch: jest.fn().mockReturnValue({
          getResponseCode: () => responseCode,
          getContentText: () => content,
          getAllHeaders: () => ({}),
        }),
      };
    };

    it('should return parsed text when json parameter is false', () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { data: 'Hello ' } },
                { inlineData: { data: 'World!' } },
              ],
            },
          },
        ],
      };
      mockUrlFetchApp(200, JSON.stringify(mockResponse));

      const promptParts: PromptPart[] = [{ type: 'text', value: 'Say hello' }];
      const result = api.callGeminiApi(promptParts, false);

      expect(result).toBe('Hello World!');
    });

    it('should return text response when json parameter is true', () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Parsed JSON result text' }],
            },
          },
        ],
      };
      mockUrlFetchApp(200, JSON.stringify(mockResponse));

      const promptParts: PromptPart[] = [{ type: 'text', value: 'Give JSON' }];
      const result = api.callGeminiApi(promptParts, true);

      expect(result).toBe('Parsed JSON result text');
    });

    it('should include imageConfig when model contains "image"', () => {
      // Initialize a multimodal model instance
      const multimodalApi = new VertexAiApi(
        'mock-project',
        'us-central1',
        'aiplatform.googleapis.com',
        'mocked-model-image',
        '16:9'
      );

      mockUrlFetchApp(200, JSON.stringify({ candidates: [] }));

      multimodalApi.callGeminiApi([{ type: 'text', value: 'test' }]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global as any).UrlFetchApp.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          payload: expect.stringContaining(
            '"imageConfig":{"aspectRatio":"16:9"'
          ),
        })
      );
    });

    it('should include responseSchema when schema is set', () => {
      mockUrlFetchApp(200, JSON.stringify({ candidates: [] }));

      const schema = {
        type: 'OBJECT',
        properties: { key: { type: 'STRING' } },
      };
      api.callGeminiApi([{ type: 'text', value: 'test' }], false, schema);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global as any).UrlFetchApp.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          payload: expect.stringContaining('"responseSchema"'),
        })
      );
    });

    it('should throw GeminiApiCallError on non-200 response', () => {
      mockUrlFetchApp(400, 'Bad Request');

      expect(() =>
        api.callGeminiApi([{ type: 'text', value: 'test' }])
      ).toThrow('Bad Request');
    });

    it('should throw JsonParseError when response is not valid JSON', () => {
      mockUrlFetchApp(200, 'Not a JSON string');

      expect(() =>
        api.callGeminiApi([{ type: 'text', value: 'test' }])
      ).toThrow('Not a JSON string');
    });
  });
});

describe('queryGemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).ScriptApp = {
      getOAuthToken: jest.fn().mockReturnValue('mock-oauth-token'),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).Utilities = {
      sleep: jest.fn(),
    };
  });

  it('should successfully call Vertex AI Api through helper', () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Success' }],
          },
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).UrlFetchApp = {
      fetch: jest.fn().mockReturnValue({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(mockResponse),
        getAllHeaders: () => ({}),
      }),
    };

    const result = queryGemini(
      [{ type: 'text', value: 'test' }],
      'my-project',
      'mocked-model'
    );

    expect(result).toBe('Success');
  });
});
