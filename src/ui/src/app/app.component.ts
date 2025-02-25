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
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, NgZone, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import {
  bufferCount,
  firstValueFrom,
  forkJoin,
  from,
  interval,
  zip,
} from 'rxjs';
import { AppsScriptHelper } from '../apps-script-helper';

interface BackgroundDefinition {
  title: string;
  description: string;
}

interface Config {
  driveFolderId: string;
  projectId: string;
  region: string;
  modelId: string;
  backgroundDefinitions: BackgroundDefinition[];
}

interface ImageQueue {
  folderId: string;
  outputFolderId: string;
  fileName: string;
  fileId: string;
  prompt: string;
  variationId: number;
}

interface VertexApiResponse {
  predictions: {
    bytesBase64Encoded: string;
    mimeType: string;
  }[];
}

const BATCH_SIZE = 10;
const BATCH_TIME_BETWEEN_REQUESTS = 10000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatCardModule,
    MatProgressBarModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'ui';
  driveFolderId = '';
  projectId = '';
  region = '';
  modelId = '';
  oAuthToken = '';
  backgroundRemoval = false;
  isLoading = false;
  loadingProgress?: number = undefined;

  form: FormGroup = this.formBuilder.group({
    backgrounds: this.formBuilder.array(
      [].map(bg => this.formBuilder.group(bg))
    ),
  });

  get backgrounds(): FormArray {
    return this.form.get('backgrounds') as FormArray;
  }

  constructor(
    private ngZone: NgZone,
    private formBuilder: FormBuilder,
    private httpClient: HttpClient
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    AppsScriptHelper.run<Config>('getConfig').then(config => {
      this.isLoading = false;
      this.driveFolderId = config.driveFolderId;
      this.projectId = config.projectId;
      this.modelId = config.modelId;
      this.region = config.region;
      config.backgroundDefinitions.forEach(bg => {
        this.addBackground(bg.title, bg.description);
      });
    });
  }

  saveConfig() {
    const config: Config = {
      driveFolderId: this.driveFolderId,
      projectId: this.projectId,
      region: this.region,
      modelId: this.modelId,
      backgroundDefinitions: this.backgrounds.value,
    };
    AppsScriptHelper.run('setConfig', config);
  }

  addBackground(title: string = '', description: string = '') {
    this.backgrounds.push(
      this.formBuilder.group({
        title,
        description,
      })
    );
  }

  removeBackground(index: number) {
    this.backgrounds.removeAt(index);
  }

  getImageAssets() {
    this.isLoading = true;
    AppsScriptHelper.run('getImageAssets', this.driveFolderId).then(() => {
      this.isLoading = false;
    });
  }

  processAssets() {
    this.isLoading = true;
    AppsScriptHelper.run('setHeaders', this.backgrounds.value);
    AppsScriptHelper.run(
      'processImageAssets',
      this.backgrounds.value,
      this.projectId,
      this.region,
      this.modelId,
      this.backgroundRemoval
    ).then(() => {
      this.isLoading = false;
    });
  }

  addFolderToQueue() {
    this.isLoading = true;
    AppsScriptHelper.run(
      'addFolderToQueue',
      this.driveFolderId,
      this.backgrounds.value
    ).then(() => {
      this.isLoading = false;
    });
  }

  async createVertexAiCall(current: ImageQueue) {
    const vertexEndpoint = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.modelId}:predict`;
    const imageBlob = await firstValueFrom(
      this.httpClient.get(
        `https://www.googleapis.com/drive/v3/files/${current.fileId}?alt=media`,
        {
          headers: {
            authorization: `Bearer ${this.oAuthToken}`,
          },
          responseType: 'blob',
        }
      )
    );
    const reader = new FileReader();
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
    const requestBody = this.getImagenRequestBody(current.prompt, imageBase64);
    return this.httpClient.post<VertexApiResponse>(
      vertexEndpoint,
      requestBody,
      {
        headers: {
          authorization: `Bearer ${this.oAuthToken}`,
        },
      }
    );
  }

  getImagenRequestBody(prompt: string, imageBase64: string) {
    if (this.modelId.startsWith('imagegeneration@')) {
      return JSON.stringify({
        instances: [
          {
            prompt: prompt,
            image: {
              bytesBase64Encoded: imageBase64,
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
    } else if (this.modelId.startsWith('imagen-3.0')) {
      if (this.backgroundRemoval) {
        return JSON.stringify({
          instances: [
            {
              prompt,
              referenceImages: [
                {
                  referenceType: 'REFERENCE_TYPE_RAW',
                  referenceId: 1,
                  referenceImage: {
                    bytesBase64Encoded: imageBase64,
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
        return JSON.stringify({
          instances: [
            {
              prompt,
              referenceImages: [
                {
                  referenceType: 'REFERENCE_TYPE_RAW',
                  referenceId: 1,
                  referenceImage: {
                    bytesBase64Encoded: imageBase64,
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
    } else throw Error(`Unsupported model: ${this.modelId}`);
  }

  async run() {
    this.isLoading = true;
    this.oAuthToken = await AppsScriptHelper.run('getOAuthToken');
    const imageQueue =
      await AppsScriptHelper.run<ImageQueue[]>('getImagesToProcess');
    let batchNumber = 0;
    let completedBatches = 0;
    this.loadingProgress = 0;
    const totalBatches = Math.ceil(imageQueue.length / BATCH_SIZE);
    zip(
      from(imageQueue).pipe(bufferCount(BATCH_SIZE)),
      interval(BATCH_TIME_BETWEEN_REQUESTS)
    ).subscribe(async ([batch]) => {
      console.log(batch);
      batchNumber++;
      console.log(`Running batch ${batchNumber}/${totalBatches}`);
      forkJoin(
        await Promise.all(
          batch.map(async e => await this.createVertexAiCall(e))
        )
      ).subscribe({
        next: res => {
          res.forEach((e, i) => {
            AppsScriptHelper.run(
              'writeToDrive',
              batch[i].outputFolderId,
              `${batch[i].fileName.split('.').slice(0, -1).join('.')}-${
                batch[i].variationId
              }`,
              e.predictions[0].bytesBase64Encoded,
              e.predictions[0].mimeType
            );
          });
          completedBatches++;
          this.loadingProgress = (completedBatches / totalBatches) * 100;
        },
        complete: () => {
          if (completedBatches === totalBatches) {
            this.isLoading = false;
            this.loadingProgress = undefined;
          }
        },
      });
    });
  }
}
