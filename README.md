<!--
Copyright 2024 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# BackgroundR on 🍌s

[![GitHub last commit](https://img.shields.io/github/last-commit/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/commits)
![GitHub Release](https://img.shields.io/github/v/release/google-marketing-solutions/backgroundr)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)
[![GitHub License](https://img.shields.io/github/license/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/graphs/contributors)

## Overview

**BackgroundR 2.0** leverages Google's Nano Banano model for comprehensive AI image editing. Far beyond simple background replacement, it instantly performs any visual edit needed to align your image assets with your corporate brand guidelines.

## Updates

- **March 2026.** BackgroundR **2.0** with Nano Banano.
- **December 2024.** Support for Imagen 3.
- **August 2024** Initial release.

## Getting Started

We aim to keep BackgroundR simple yet scalable. As a result, we have built it as an Apps Script extension running on top of Google Sheets. To get started, follow the instructions below:

1. Make a copy of this [Google Sheet](https://docs.google.com/spreadsheets/d/1FPlQbvqovVNlUFsCLJ9c_aEZ9bMDiZxVi4VsDn7daWM/copy).
2. Find the "BackgroundR on 🍌s" menu in the menu bar and select "🎨 Open configurator". You might need to authorize the sheet to run on your behalf.
3. Create a Google Drive folder to store your raw "base" product images.
4. Copy your Google Drive folder's ID into "Drive Folder ID". The ID is found in the link to your folder path and it should be something like: "1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF"
   Example: https://drive.google.com/corp/drive/folders/1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF?resourcekey=0-wsFV1FiGbn_BRFcYY4Zs3A
5. Now you can load your images from the Drive folder by selecting "📥 Load images from Google Drive" from the "BackgroundR on 🍌s" menu. Your original product images will load in Column A.
   Enter your Google Cloud Project ID as well as the cloud region where you want to generate the images e.g. "europe-west3" or "us-central1". Look [here](https://cloud.google.com/vertex-ai/docs/general/locations) for additional available regions.
   > **Note:** BackgroundR only creates new images if a certain cell is empty. Clear columns E, F, and G if there are already images and you want to replace them.
   > **Note:** Nano Banano has a file size limit of ~30MB. Images larger than this will be skipped during loading.
6. Define your image elements in the 'Dropdowns' sheet (elements to be added to the image as text prompts only) and ingredients in the 'Ingredients' sheet (exact images to be added to the final image). Ensure these sheet names are correctly configured in the 'Config' sheet.
7. Click the "Apply Selections" or "Universal Generate" button in the BackgroundR sidebar, and allow some time for it to load!

## Menu Items

- **🎨 Open configurator**: Opens the sidebar configuration tool.
- **📥 Load images from Google Drive**: Loads images from the configured Drive folder into the sheet.
- **💾 Save selected images to Drive**: Saves the currently selected images in the sheet back to Google Drive.
- **🧹 Clear generated images**: Clears the generated images from the sheet.

## Configuration

The "Config" sheet allows you to customize the behavior of BackgroundR. Below is a description of each option:

- **Cloud Project Id**: Your Google Cloud Project ID where the Vertex AI API is enabled.
- **Image Generation Model**: The model ID used for image generation (e.g., `gemini-2.5-flash-image` or newer versions).
- **Scoring Model**: The model ID used for scoring images (e.g., `gemini-2.5-flash` or newer versions).
- **Drive Folder Id**: The ID of the Google Drive folder containing your source images. Please note this is not the URL of the folder, but the ID of the folder. You can find it in the URL of the folder, for example: https://drive.google.com/corp/drive/folders/1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF?resourcekey=0-wsFV1FiGbn_BRFcYY4Zs3A, the ID is `1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF`.
- **GCP Location**: The Google Cloud region to use for API calls (e.g., `us-central1`, `europe-west3`).
- **Dropdowns sheet**: The name of the sheet containing your background variant definitions (text prompts).
- **Ingredients sheet**: The name of the sheet containing your ingredient definitions (image assets).
- **Prompt Prefix**: Text that will be automatically prepended to every generated prompt.
- **Prompt Suffix**: Text that will be automatically appended to every generated prompt.
- **Image Scoring Prompt**: The prompt used by the scoring model to evaluate the quality of generated images.
- **Scoring results sheet**: The name of the sheet where image scoring results will be saved.

## Scoring

BackgroundR includes an automated quality control mechanism that scores generated images using a Gemini model.

1.  **Evaluation**: Each generated image is sent to the configured **Scoring Model** along with the **Image Scoring Prompt**.
2.  **Scoring**: The model evaluates the image and returns a numerical **Score** and reasoning. The scoring results are logged in the **Scoring results sheet**.
3.  **Threshold Check**: The system compares the returned score against your defined **Scoring threshold**.
    -   If the score is **greater than or equal to** the threshold, the image is accepted.
    -   If the score is **below** the threshold, the system will discard the image and automatically regenerate a new version.
4.  **Regeneration**: This process repeats until a satisfactory image is generated or the **Max regeneration** limit is reached.

## Requirements

BackgroundR uses Google Cloud Platform's Vertex AI models. In order to use BackgroundR, you need access to a Google Cloud Project with the [Vertex AI API](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-quickstart) enabled.

## Disclaimer

**This is not an officially supported Google product.**
