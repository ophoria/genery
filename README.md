# Genery - Local & Browser Image Gallery

An advanced, high-performance image gallery application written in **TypeScript**, **React**, **Vite**, **Express**, and **Tailwind CSS**. Designed for local execution in the browser with extensive filtering, sorting, keyboard navigation, rating, tagging, commenting, and bulk filesystem management.

---

## 🌟 Key Features

### 📁 1. Directory & Subdirectory Scanning
- Scan any local folder path with a toggle for **recursive subdirectory scanning**.
- Interactive **Folder Picker Modal** to browse local directories directly in the application.
- Sort the folder picker by name, filesystem creation date, or last selection in Genery, in ascending or descending order. Sort preferences and selection history are saved in this browser; folders with unknown dates or no selection history appear last.
- Real-time extraction of image dimensions (width, height, aspect ratio), file sizes, extensions, and creation/modification timestamps.
- Fast cached thumbnail generation powered by Sharp.

### 🔍 2. Robust & Extensive Filter & Logic Builder
- **File Extensions Filter**: Filter by `JPG`, `PNG`, `WebP`, `GIF`, `SVG`, `BMP`, `AVIF`, `TIFF`, or any supported format.
- **Dimensions & Aspect Ratio**: Filter by min/max width, min/max height, and aspect ratios (*Landscape*, *Portrait*, *Square*).
- **Date Ranges**: Creation date range filtering (*From Date*, *To Date*).
- **Score Rating**: Filter by star rating (1–5 stars).
- **Hashtags**: Filter by tags using `AND`, `OR`, or `NOT` logic.
- **Advanced AND / OR / NOT Expression Builder**: Build nested conditional rules on any file property.
- **Sorting**: Sort by Score Rating, Creation Date, Modification Date, File Name, Resolution (Width/Height), or File Size (Ascending / Descending).

### ⌨️ 3. Keyboard & Mouse Controls
- **Arrow Keys (`Up`, `Down`, `Left`, `Right`)**: Navigate thumbnail selection grid smoothly.
- **Scroll Wheel**: Scroll gallery grid effortlessly.
- **`1` – `5`**: Rate the image under the mouse pointer (1 to 5 stars). When no thumbnail is hovered, rate all selected images, or the highlighted image when nothing is selected. Bulk-rating notifications show the saved count and rating.
- **`Enter`**: Open the **Hashtag Box** to add/edit hashtags for the highlighted image.
- **`Shift + Enter`**: Open the **Comment Box** to add/edit notes/comments for the highlighted image.
- **`F` / Green maximize button**: Toggle screen fullscreen without changing views. In thumbnail mode, hide the toolbar, side panels, filters, appearance controls, and status bar so only the gallery remains. Press **F** or **Esc** to restore the workspace.
- **`Space`**: Open the image in **Quick Look** (AR 1:1 container view).
- **In Quick Look**:
  - **`Left` / `Right` Arrow Keys**: Go to previous or next image.
  - **Clicking Left / Right Overlay Zones**: Navigate to previous or next image.
  - **`Z` Key**: Toggle between **100% Real Size** (actual pixel rendering) and **Fit View**.
  - **`ESC` Key**: Exit fullscreen mode or close any modal dialog back to the gallery.

### 📦 4. Bulk File Operations (Copy / Delete / Rename / Zip)
- **Target Scope**: Perform operations on **All Filtered Images** or **Manually Selected Images**.
- **Batch Copy**: Copy files to a chosen target folder.
- **Bulk Delete**: Safely delete files from disk with confirmation.
- **Batch Rename**: Rename files using template patterns (e.g., `photo_{n:3}`, `{orig}`, `{date}`, `{ext}`).
- **Zip Compression**: Compress selected or filtered images into a downloadable `.zip` archive file.

### Thumbnail Appearance
- **Colored Ratings** on/off: frame rated thumbnails in red (1), orange (2), light blue (3), blue (4), or green (5). Off by default; unrated images have no rating frame. While enabled, selection uses a white checkmark and neutral filename highlight; the focused filename is underlined instead of using a blue frame.
- Adjustable thumbnail size and aspect ratio.
- Top, center, or bottom crop alignment, with center as the initial default.
- Global alignment and independent folder overrides; subfolders inherit the nearest parent setting unless overridden.
- Appearance settings persist in browser storage between sessions.
- A wider gallery scrollbar and automatic return to the top after successful scans.

### Local AI Classification

Open **AI** in the toolbar (or **Analyze** in the inspector). Each model family has its own settings panel:

- **RAM / RAM++:** automatic subject and scene tags, recommended per-tag thresholds or a custom threshold, maximum tags, and excluded tags.
- **WD Taggers:** SwinV2 v3 and EVA02 Large v3, general and character thresholds, optional named-character/content-rating tags, and exclusions. These models are trained on Danbooru illustrations and use the local ONNX CPU runtime.
- **SigLIP 2:** Base and SO400M variants, editable classification groups, descriptions, a game-art vocabulary preset, description templates, minimum scores, and maximum matches per group. Label lines use `group | label | description`. Scores are matching scores, not calibrated confidence percentages.

Click **Install model** to create an isolated Python environment and download its weights. Python 3.10+ is required; RAM also requires git for its pinned upstream implementation. RAM and SigLIP support Apple GPU (MPS), automatic selection, and CPU. Model installation needs internet access; analysis uses only locally cached weights and images.

Analyze the current image, selected images, or all filtered images. A background task reports progress and per-image failures, can be cancelled, and continues when its window is closed. Completed results are saved immediately. A server restart stops the task; running analysis again skips completed images with matching settings. Changed image files or changed settings cause reanalysis. Enable **Reanalyze cached images** to force it.

AI suggestions appear separately in the inspector with model names and scores. Click a suggestion or **Add suggestions to my tags** to save it as a regular hashtag. Gallery search includes AI tags; the advanced query builder has **AI tag**, **AI category**, and **AI model** conditions. Analyzing another variant in the same family replaces that family's suggestions for the image; results from the other families remain available.

Settings, result records, and the isolated runtime live in `~/.genery/ai/`. Hugging Face stores downloaded weights in its normal local cache. `GENERY_AI_HOME` overrides the settings/runtime/result directory; `GENERY_AI_PYTHON` selects the Python executable used to create the environment. Original images are not modified. Transparent images are analyzed against white; animated images use their first frame.

Model options are saved when you click **Save settings**, start analysis, or install a model. **Save & close** keeps edits across all model tabs; **Discard changes** closes without saving edited options. Running-task progress and cancellation remain visible while you scroll the settings.

Verification commands:
```bash
npm run test:ai
npm run ai:smoke -- wd-swinv2 /path/to/image.png
```
The smoke command installs the chosen variant if needed and performs actual local inference; it saves AI results for that image.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (tested on Node.js v22)
- npm v9+

### Running the Application

Install dependencies first:
```bash
npm install
```

1. Start both backend server and Vite frontend concurrently:
   ```bash
   npm run dev
   ```
   `npm start` also starts both services. `npm run client` starts only the frontend and requires `npm run server` in another terminal.

   Or use the included launcher script:
   ```bash
   ./start.sh
   ```

2. Open your browser at:
   ```
   http://localhost:5173
   ```

3. Generate sample test images for testing:
   ```bash
   npm run generate-test-data
   ```

---

## 🛠️ Architecture

- **`server/index.ts`**: Express backend serving local images, thumbnails, metadata updates, and batch filesystem operations.
- **Settings:** Open the toolbar cog and choose **Export image metadata** to save a JSON copy of all image ratings, hashtags, and comments. Supported browsers offer a save dialog; other browsers use their configured download location. Exporting preserves the original metadata file. **Import image metadata** merges a Genery JSON export into saved metadata, replacing matching fields and retaining other entries. The previous metadata file is backed up to `~/.genery_image_metadata.backup.json` before import; each subsequent import replaces that backup. Image paths must match their current locations.

- **`server/metadataStore.ts`**: Persistent storage for image scores, hashtags, and comments saved in `~/.genery_image_metadata.json`.
- **`server/scanner.ts`**: High-speed recursive directory scanner using `image-size` and `sharp`.
- **`server/operations.ts`**: File copying, deleting, pattern renaming, and ZIP archive compilation (`archiver`).
- **`src/utils/filterEngine.ts`**: Client-side filtering and sorting engine with full support for nested AND/OR/NOT rule trees.
- **`src/components/`**: Modular React components for header, grid, thumbnail card, fullscreen viewer, filter panel, logic builder, and modals.

### AI progress and directory statistics

Analysis shows whole-number progress percentages in the modal and, when closed, below the folder toolbar. The running display estimates minutes remaining and finish time after the first analyzed image. Completed runs show elapsed wall time and average wall time per analyzed image; cached-only runs show no per-image average. A run finishing while the modal is closed displays “AI Analysis done”.

Search matches names, comments, manual tags, and AI tags. Filters include all specified tags and exclude any specified tags across manual and AI results; the existing hashtag controls remain available for manual-only filtering.

Open **Statistics** in the toolbar (or mobile controls) to see AI tag statistics for the last scanned directory and its scanned subfolder scope, independently of gallery filters. The page includes the 12 most frequent tags, model coverage, and every identified tag with distinct image counts, directory share, groups, contributing models, and mean match score. Tags are deduplicated per image across models, using the highest score for each image/tag pair. Model selection, tag search, and ascending/descending sorting by name, image count, or average score are available. Clicking a tag opens the matching gallery images.

Ctrl+F toggles the distraction-free gallery within the current app window, preserving its size. Escape restores the controls. Command+F focuses search; F or the green button still toggles screen fullscreen.

### Network access and accounts

Settings → Access contains separate local network and internet switches. Both default to off. The local control listener binds to `127.0.0.1:3001`; Vite development access also stays on loopback. Use `npm run serve` to build and serve the complete interface from the application server. Remote listeners serve this production build.

- Local network: port `3002`, restricted to RFC1918 private IPv4 and IPv6 unique-local peers. Password mode requires HTTPS and a created administrator account. Password-free access uses an explicit normal/moderator guest role and allowed directories; it does not grant administrator authority. Disable LAN access and save before switching its password mode.
- Internet: HTTPS port `3443`, mandatory account login and an exact public HTTPS address. Configure your certificate and private key through `GENERY_TLS_CERT` and `GENERY_TLS_KEY` before starting the server. The certificate must be trusted by clients and cover the address they use. Configure routing/firewall rules separately; enabling a setting does not open router ports. Forwarded headers are not trusted, and HTTP TLS termination in front of the app is unsupported; use TLS passthrough or HTTPS to the internet listener.
- Users: admins retain full gallery access. Moderators can organize and annotate authorized images but cannot delete files or overwrite archives. Normal users can browse, search, filter, and read. Restricted accounts need directory grants with an explicit subfolder option. Only local/LAN administrators can create, edit, remove, or list accounts. Network configuration requires the local owner connection. Moderators can install supported AI models, save their own model settings, analyze granted images, and cancel their own tasks. Administrator model settings remain global.
- Account passwords use salted scrypt and must be unique passphrases of 15–128 characters. Account data is stored privately in `~/.genery/access.json`. Cookie sessions expire after 30 minutes idle or 12 hours total, and updates to accounts/network access revoke sessions. Symlinks are rejected for restricted paths, with authorization enforced by the server independently of UI controls.

Optional environment overrides: `PORT`, `GENERY_LAN_PORT`, `GENERY_INTERNET_PORT`, `GENERY_ACCESS_PATH`, and `GENERY_METADATA_PATH`. Keep the security configuration and TLS key accessible only to the local OS account running Genery.

Enabled connection addresses appear in Settings → Access. Each address has a Copy button that copies the complete URL, including the port, for sharing. LAN addresses come from this machine's private network interfaces; internet access uses the configured public HTTPS address.

Run `npm run test:security` for the adversarial access suite, including real TLS/listener transitions, IPv4/IPv6 listeners, configuration rollback, session lifecycle, and access revocation during streaming. The security and regression suites pass, and BrowserOS verification covers desktop/mobile settings, connection copying (including the HTTP fallback), account editing, scoped folder navigation, role controls, and session revocation. See `docs/security/completion-audit.md` for the verification record.
