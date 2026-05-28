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
import {isDevMode} from '@angular/core';

// Mock google.script.run API if running locally outside Google Apps Script
// environment and in Angular development mode.
if (isDevMode() && typeof (window as any).google === 'undefined') {
  const createMockRun = (successCb?: Function, failureCb?: Function) => {
    const runner: any = {
      withSuccessHandler: (cb: Function) => createMockRun(cb, failureCb),
      withFailureHandler: (cb: Function) => createMockRun(successCb, cb),
      loadDropDowns: () => {
        console.log('Mock: loadDropDowns() called');
        if (successCb) {
          setTimeout(() => {
            successCb({
              variants: {
                'Background': [
                  'Warm Studio',
                  'Soft Glow',
                  'Neon Night',
                  'Sunny Kitchen',
                ],
                'Style': ['Modern', 'Rustic', 'Cyberpunk', 'Organic'],
              },
              ingredients: {
                'Ingredient A': [
                  {
                    name: 'Orange Slice',
                    thumbnail: 'https://picsum.photos/id/1084/100',
                    fileId: 'file_orange',
                  },
                  {
                    name: 'Mint Leaf',
                    thumbnail: 'https://picsum.photos/id/1043/100',
                    fileId: 'file_mint',
                  },
                ],
              },
              menus: [
                {
                  title: 'Customise your variants',
                  items: ['Background', 'Style'],
                },
                {
                  title: 'Ingredients',
                  items: ['Ingredient A'],
                },
              ],
            });
          }, 800);
        }
      },
      generateImages: (...args: any[]) => {
        console.log('Mock: generateImages() called with:', args);
        if (successCb) {
          setTimeout(() => {
            successCb();
          }, 1500);
        }
      },
    };
    return runner;
  };

  (window as any).google = {
    script: {
      run: createMockRun(),
    },
  };
}
