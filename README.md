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

# BackgroundR

## Overview

BackgroundR automatically creates new backgrounds for your images based on a text-prompt. AI-based in-painting using Google's latest Imagen models ensures natural-looking background replacement. The tool is capable of exchanging backgrounds in bulk across many assets.

## Updates

- **December 2024.** Support for Imagen 3.
- **August 2024** Initial release.

## Getting Started

We aim to keep BackgroundR simple yet scalable. As a result, we have built it as an Apps Script extension running on top of Google Sheets. To get started, follow the instructions below:

1. Make a copy of this [Google Sheet](https://docs.google.com/spreadsheets/d/1FPlQbvqovVNlUFsCLJ9c_aEZ9bMDiZxVi4VsDn7daWM/edit?gid=1500542581#gid=1500542581).
2. Find the BackgroundR menu in the menu bar and select "Open". You might need to authorize the sheet to run on your behalf.
3. Create a Google drive folder to store your raw "base" product images.
4. Copy your Google drive folder's ID into "Driver Folder ID". The ID is found in the link to your folder path and it should be something like: "1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF"
   Example: https://drive.google.com/corp/drive/folders/1jt88MGoqMTGhuGYujiOpY8wUD_3aZsJF?resourcekey=0-wsFV1FiGbn_BRFcYY4Zs3A
5. Now you can load your images from the drive folder by clicking the "Get Images" button in the BackgroundR sidebar. Your original product images will load in Column A.
   Enter you Google Cloud Project ID as well as the cloud region where you want to generate the images e.g. europe-west3. Look [here](https://cloud.google.com/vertex-ai/docs/general/locations#europe) for additional available regions.
   > **Note:** BackgroundR only create new images if a certain cell is empty. Clear column E F G if there are already images and you want to replace them.
6. Add background variants that you would like to generate within the BackgroundR sidebar. Save the config if you want to keep it for later use.
7. Click the button "Creative variants".
   and give some time for it to load!

## Requirements

BackgroundR uses Google Cloud Platform's Vertex AI models. In order to use BackgroundR, you need access to a Google Cloud Project with the [Vertex AI API](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-quickstart) enabled.

## Disclaimer

**This is not an officially supported Google product.**
