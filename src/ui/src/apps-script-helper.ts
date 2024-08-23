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
export class AppsScriptHelper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async run<T = void>(functionName: string, ...args: any[]) {
    return new Promise<T>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      google.script.run
        .withSuccessHandler((response: T) => {
          resolve(response);
        })
        .withFailureHandler((error: Error) => {
          reject(error);
        })
        [functionName](...args);
    });
  }
}
