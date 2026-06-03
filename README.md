# Show Controller

夏令營影音流程自動化控台（Electron 桌面應用）。提供 Cue 清單、音／影／圖片／文字投影播放、淡入淡出、緊急切斷（Panic）、SFX 音效盤、時間軸與時間點排程。

## 現場操作功能

- **鍵盤快捷鍵 / GO**：`Space` 播放暫停、`G`/`Enter` GO 觸發下一 Cue、`↑↓` 選取、`1–9` 跳 Cue、`S` 停止、`F` 淡出、`I` 淡入、`D` Duck、`Esc` PANIC、`?` 快捷鍵說明。
- **Pre-wait / 自動接續延遲**：每個 Cue 可設定播放前等待與自動接續延遲。
- **Crossfade**：切換音訊 Cue 時交叉淡接，避免空白。
- **倒數計時視窗**：大字時鐘可彈出至副螢幕給導演／舞台看（剩 30s 轉黃、10s 轉紅）。
- **圖片 / 文字投影 Cue**：歌詞、公告、LOGO 直接推送到獨立投影視窗。
- **Cue 顏色標記 / 備註 / 搜尋**：快速辨識與定位 Cue。
- **真實波形 + 旗標**：解碼實際音檔繪製波形，點波形可新增／移除旗標。

## 開發

```bash
npm install
npm start          # 啟動 Electron
npm run build      # 打包 Windows 安裝檔 (nsis + portable)
```

## 架構

```
main.js       Electron 主程序
              ├─ 本機 HTTP 媒體伺服器（支援 Range request，僅允許媒體副檔名白名單）
              ├─ IPC handlers（專案讀寫、檔案對話框、shell）
              └─ BrowserWindow（contextIsolation 開啟、nodeIntegration 關閉）
preload.js    Context bridge，安全暴露 electronAPI 給 renderer
src/index.html  Renderer（UI + 播放引擎 + 時間軸 + 排程）
```

## 安全性設計

- **媒體伺服器副檔名白名單**：`main.js` 只服務音／影副檔名，封鎖任意檔案讀取（防路徑穿越）。
- **webSecurity 維持開啟**：媒體透過 `http://127.0.0.1` 本機伺服器播放，不需停用瀏覽器安全機制。
- **輸入消毒**：所有寫入 `innerHTML` 的使用者資料皆經過 `esc()`；URL 輸入限制 `http/https`；匯入 JSON 經 `sanitizeProject()` 結構驗證。
- **原子寫入**：`project:save` 先寫 `.tmp` 再 `rename`，避免寫入中途 crash 導致 JSON 損毀。

## 已知後續工作

- Renderer 仍為單一檔案（~2000 行）。後續可拆分為 `audio-engine` / `video-engine` / `ui-*` / `persistence` 等模組以提升可維護性。
- 尚無自動化測試。
