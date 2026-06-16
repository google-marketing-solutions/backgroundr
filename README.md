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

# 🍌 BackgroundR 2.0

[![GitHub last commit](https://img.shields.io/github/last-commit/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/commits)
![GitHub Release](https://img.shields.io/github/v/release/google-marketing-solutions/backgroundr)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)
[![GitHub License](https://img.shields.io/github/license/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/google-marketing-solutions/backgroundr)](https://github.com/google-marketing-solutions/backgroundr/graphs/contributors)

## 📖 Overview

**BackgroundR 2.0** leverages Google's **Nano Banana** model for comprehensive AI image editing. Far beyond simple background replacement, it instantly performs any visual edit needed to align your image assets with your corporate brand guidelines.

Built as an elegant, web-native Google Sheets Add-on, BackgroundR lets you process images in bulk directly from Google Sheets, powered by Gemini Enterprise Agent Platform (formerly Vertex AI).

--------------------------------------------------------------------------------

[Key Features](#-key-features) •
[Architecture & Tech Stack](#-architecture--tech-stack) • [Getting Started](#-getting-started) •
[Configuration Options](#-configuration-options) •
[Scoring](#-scoring--automated-regeneration) •
[Developer Guide](#-developer-guide)

--------------------------------------------------------------------------------

## ✨ Key Features

- 🍌 **State-of-the-art AI Models**: Native integration with **Nano Banana**.
- ⚙️ **Configurable Prompts**: Prepend and append custom prompt prefixes/suffixes automatically to match your brand style.
- 📂 **Bulk Google Drive Syncing**: Load and save images to and from designated Drive folders seamlessly.
- 📐 **Advanced Multi-variant Generation**: Custom sheets to define ingredient images and text variants to overlay or outpaint.
- 🎯 **Automated Quality Control**: Scoring mechanism powered by Gemini to ensure every generated asset meets your quality threshold.

---

## 🛠️ Architecture & Tech Stack

BackgroundR uses a modern, lightweight stack to deliver advanced GenAI features inside Google Workspace:

- **Frontend (Sidebar UI)**: Built with **Angular 19** as a single-page application, optimized for seamless interactions.
- **Backend Engine**: Powered by **TypeScript** transpiled to **Google Apps Script**, managed with [Clasp](https://github.com/google/clasp).
- **Generative AI APIs**: Integrated directly with GCP's **Gemini Enterprise Agent Platform (formerly Vertex AI)** (Nano Banana).

---

## 🚀 Getting Started

We aim to keep BackgroundR simple yet scalable. Follow these steps to set up and start generating assets:

### 1. Clone the Google Sheet Template
Make a copy of this [Google Sheet Template](https://docs.google.com/spreadsheets/d/1e4oivqNoTFDTBKlpXi__8H5U0s2BwQg4hRR9z2UgARU/copy).

### 2. Set Up Your Drive Directories
1. Create a folder in Google Drive to store your raw "base" product images.
2. Copy your folder's ID from its URL.
   > **Example**: For URL `https://drive.google.com/drive/folders/1zUg7xdx3d28M3KlbGKOcU-G05SdiqEN3`, the folder ID is `1zUg7xdx3d28M3KlbGKOcU-G05SdiqEN3`.

### 3. Open the Configurator
In the Google Sheet menu bar, go to **BackgroundR on 🍌s** > **🎨 Open configurator**.
> [!NOTE]
> You might need to authorize the script to run in your account on the first launch.

### 4. Configure your GCP Project & Drive Folder
Under the **Config** sheet set:
- **Cloud Project ID**: Your GCP Project where the Gemini Enterprise Agent Platform (formerly Vertex AI) API is enabled.
- **GCP Location**: Region of your choice (e.g. `global` or `us-central1`).
- **Drive Folder ID**: Paste the Google Drive folder ID copied in Step 2.

> [!IMPORTANT]
> Ensure the [Gemini Enterprise Agent Platform (formerly Vertex AI) API](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-quickstart) is enabled on your GCP Project.

### 5. Run and Generate
1. Select **BackgroundR on 🍌s** > **📥 Load images from Google Drive** to pull your images (files up to 30MB only, which is a Nano Banana limitation) into Column A of the `Images` sheet.
2. Set your variants in the `Dropdowns` and `Ingredients` sheets.
3. Configure your output preferences in the sidebar:
   - **Aspect Ratio**: Select the desired dimensions for the generated images (e.g. 1:1, 16:9).
     > [!NOTE]
     > Do not change the dropdown in case you want to preserve the original aspect ratio of your images.
   - **Number of Images**: Specify how many variations to generate per asset.
     > [!NOTE]
     > BackgroundR only generates images into *empty* cells. If you request 2 images but there are already 2 images in the row, no generation will happen. To fix this and force regeneration, clear the existing images first manually (by selecting the corresponding cells and pressing the Delete key) or using the **BackgroundR on 🍌s** > **🧹 Clear generated images** menu option.
   - **Automated Scoring (Optional)**: Check this to ensure asset quality. When enabled, specify a **Threshold** (the minimum acceptable score from the Gemini evaluator) and **Max Regenerations** (how many times to retry generating an image if it falls below the threshold).
4. Choose your generation method using the buttons at the bottom of the sidebar:
   - **Apply Selections:** Generates variations based *only* on the specific items you have selected in the sidebar dropdowns.
   - **Universal Generate:** Acts as a bulk "I'm feeling lucky" mode. Instead of using your sidebar variant selections, it automatically reads *every* prompt combination directly from the `Dropdowns` sheet and applies them to *all* images currently loaded in the `Images` sheet. *(Note: Any Ingredients you actively select in the sidebar will still be applied)*.

---

## ⚙️ Configuration Options

The `Config` sheet governs BackgroundR behavior. Here is a description of the configurations:

| Configuration Option | Description | Example / Default Value |
| :--- | :--- | :--- |
| **Cloud Project Id** | Google Cloud Project ID with Gemini Enterprise Agent Platform (formerly Vertex AI) enabled | `my-brand-gcp-project` |
| **Image Generation Model** | Model ID used for image generation | `gemini-2.5-flash-image` |
| **Scoring Model** | Model ID used for scoring generated images | `gemini-2.5-flash` |
| **Drive Folder Id** | Google Drive Folder ID containing your source images | `1zUg7xdx3d28M3KlbGKOcU-G05SdiqEN3` |
| **GCP Location** | Cloud region for Gemini Enterprise Agent Platform (formerly Vertex AI) API calls | `us-central1` or `europe-west3` |
| **Dropdowns sheet** | The sheet defining your variant prompt definitions | `Dropdowns` |
| **Ingredients sheet** | The sheet defining ingredient image assets | `Ingredients` |
| **Prompt Prefix** | Text automatically prepended to all generated prompts | `A professional studio photo of...` |
| **Prompt Suffix** | Text automatically appended to all generated prompts | `..., high quality, brand aligned.` |
| **Image Scoring Prompt** | System instructions used to evaluate the quality of images | `Verify if the image looks realistic...` |
| **Scoring results sheet** | Sheet where image scoring results are saved | `Scoring results` |

---

## 🎯 Scoring & Automated Regeneration

To maintain production-grade standards, BackgroundR features an automated quality control loop:

```mermaid
graph TD
    A[Generate Image] --> B[Send Image to Scoring Model]
    B --> C{Score >= Scoring Threshold?}
    C -- Yes --> D[Accept Image & Write to Sheet]
    C -- No --> E[Discard Image]
    E --> F{Regen Limit Reached?}
    F -- No --> A
    F -- Yes --> G[Stop & Log Failure]
```

1. **Evaluation**: Each generated image is evaluated by the **Scoring Model** utilizing the **Image Scoring Prompt**.
2. **Scoring**: The model writes a numerical **Score** and feedback explanation to the **Scoring results sheet**.
3. **Threshold Check**:
   - If the score is **greater than or equal to** the threshold, the image is accepted.
   - If the score is **below** the threshold, it is discarded and automatically queued for regeneration.
4. **Loop Control**: Regeneration repeats until a qualified asset is generated or the **Max regeneration** limit is hit.

---

## 🧑‍💻 Developer Guide

If you are looking to modify or deploy BackgroundR yourself, follow these developer guidelines.

### Setup Requirements
- **Node.js** (>= 16.x)
- **Google Clasp** (already included in local project dependencies, or optionally installed globally: `npm install -g @google/clasp`)

### Installation
Install the parent and UI module dependencies:
```bash
npm install
```
*(This will trigger a post-install script to set up the Angular workspace inside `src/ui` automatically).*

### Local UI Development
To develop the Sidebar interface locally:
```bash
npm run serve-ui
```
This spins up the Angular development server at `http://localhost:4200`.

### Deployment
To build the TypeScript codebase, compile and inject the Angular app into Google Apps Script format, and push via [Clasp](https://github.com/google/clasp):

1. **Login to clasp**:
   ```bash
   clasp login
   ```
2. **Initialize clasp files**:
   Set up your `.clasp-dev.json` or `.clasp-prod.json` with your Google Apps Script project ID.
3. **Deploy**:
   ```bash
   # Deploy to Dev environment
   npm run deploy

   # Deploy to Production target
   npm run deploy:prod
   ```

---

## 📜 License & Disclaimer

Licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.

**This is not an officially supported Google product.**

