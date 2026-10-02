# Genery - Local & Browser Image Gallery

An advanced, high-performance image gallery application written in **TypeScript**, **React**, **Vite**, **Express**, and **Tailwind CSS**. Designed for local execution in the browser with extensive filtering, sorting, keyboard navigation, rating, tagging, commenting, and bulk filesystem management.

---

## 🌟 Key Features

### 📁 1. Directory & Subdirectory Scanning
- Scan any local folder path with a toggle for **recursive subdirectory scanning**.
- Interactive **Folder Picker Modal** to browse local directories directly in the application.
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
- Adjustable thumbnail size and aspect ratio.
- Top, center, or bottom crop alignment, with center as the initial default.
- Global alignment and independent folder overrides; subfolders inherit the nearest parent setting unless overridden.
- Appearance settings persist in browser storage between sessions.
- A wider gallery scrollbar and automatic return to the top after successful scans.

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
- **`server/metadataStore.ts`**: Persistent storage for image scores, hashtags, and comments saved in `~/.genery_image_metadata.json`.
- **`server/scanner.ts`**: High-speed recursive directory scanner using `image-size` and `sharp`.
- **`server/operations.ts`**: File copying, deleting, pattern renaming, and ZIP archive compilation (`archiver`).
- **`src/utils/filterEngine.ts`**: Client-side filtering and sorting engine with full support for nested AND/OR/NOT rule trees.
- **`src/components/`**: Modular React components for header, grid, thumbnail card, fullscreen viewer, filter panel, logic builder, and modals.
