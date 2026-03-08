# Comprehensive Verification & Test Plan

## Overview

Production 環境為 Linux (RHEL 8 UBI Docker)，本計畫涵蓋四個層級的測試，
確保從單元邏輯到 Docker 容器中的 UI/UX 端到端流程皆正常運作。

---

## Stage 1: Unit Tests — 後端邏輯驗證

**Goal**: 確認所有後端核心邏輯在 Linux 容器中行為正確
**Status**: Complete (Windows verified: 13 files, 98 tests PASS)

### 1.1 既有測試通過確認

在 Docker 內執行既有 Vitest 測試，確保 Linux 環境下結果一致：

```bash
# 在 builder stage 加入測試步驟
docker run --rm workflow-automation:test sh -c "cd /app/backend && npx vitest run"
```

**測試清單** (backend/src/__tests__/):
| 檔案 | 涵蓋範圍 |
|------|----------|
| executionEngine.test.ts | 工作流引擎核心邏輯 |
| scriptRunner.test.ts | JS/Python 腳本沙箱執行 |
| dbConnector.test.ts | 外部 DB 連接器 |
| webhooks.test.ts | Webhook 路由處理 |
| features.test.ts | 整合測試 |
| executionManager.test.ts | 執行管理器 |
| executionEventBus.test.ts | SSE 事件匯流排 |
| inputParameters.test.ts | 手動執行參數 |
| ifElseRouting.test.ts | If-Else 條件分流 |
| stationCondition.test.ts | Station 條件判斷 |
| httpRequest.test.ts | HTTP Request step |
| variableInterpolation.test.ts | 變數插值 ${} |

**Success Criteria**:
- [ ] 所有既有測試在 Docker 容器中 PASS
- [ ] Python 腳本測試在 Linux python3 環境中 PASS

### 1.2 前端單元測試

```bash
docker run --rm workflow-automation:test sh -c "cd /app/frontend && npx vitest run"
```

**測試清單** (frontend/src/):
| 檔案 | 涵蓋範圍 |
|------|----------|
| shared/stores/toastStore.test.ts | Toast 通知狀態管理 |
| shared/components/ConfirmDialog.test.tsx | 確認對話框元件 |
| features/editor/stores/workflowStore.test.ts | 工作流編輯器狀態 |

**Success Criteria**:
- [ ] 所有前端單元測試 PASS

---

## Stage 2: API Integration Tests — Docker 內 API 驗證

**Goal**: 在 Docker production image 中驗證所有 API 端點
**Status**: Complete (36/36 tests PASS — scripts/test-api-integration.js)

### 2.1 擴充 test-production.sh

在既有 `scripts/test-production.sh` 基礎上擴充，新增以下測試案例：

#### 基礎 CRUD
- [ ] POST /api/workflows — 建立 workflow
- [ ] GET /api/workflows — 列出 workflows
- [ ] GET /api/workflows/:id — 取得單一 workflow
- [ ] PUT /api/workflows/:id — 更新 workflow (name, definition, status)
- [ ] DELETE /api/workflows/:id — 刪除 workflow

#### 執行功能
- [ ] POST /api/workflows/:id/execute — 手動觸發執行
- [ ] POST /api/workflows/:id/execute (帶 inputParameters) — 參數化執行
- [ ] POST /api/workflows/:id/simulate — 模擬執行 (dry-run)
- [ ] GET /api/executions — 列出最近執行記錄
- [ ] GET /api/executions/:id — 取得單一執行結果
- [ ] GET /api/executions/:id/logs — 取得執行日誌
- [ ] DELETE /api/executions/:id — 刪除執行記錄

#### Webhook
- [ ] POST /api/webhooks/:id — Webhook 觸發 (回傳 202)
- [ ] GET /api/webhooks/:id — Webhook GET 方法

#### 排程
- [ ] GET /api/schedules — 列出排程
- [ ] PUT /api/schedules/:id/pause — 暫停排程
- [ ] PUT /api/schedules/:id/resume — 恢復排程

#### Metrics
- [ ] GET /api/metrics — Dashboard 指標數據

#### 版本控制
- [ ] GET /api/workflows/:id/versions — 版本歷史
- [ ] 驗證 save 時自動建立版本

### 2.2 Step Type 執行驗證

在 Docker 中建立含各種 step type 的 workflow 並執行：

- [ ] `trigger-manual` → 手動觸發正常啟動
- [ ] `script-js` → JavaScript VM 沙箱正確執行
- [ ] `script-python` → Python3 subprocess 在 Linux 中正確執行
- [ ] `http-request` → 外部 HTTP 呼叫 (使用 httpbin 或 mock)
- [ ] `if-else` → 條件分流 true/false 路徑正確
- [ ] `set-variable` → 變數設定與後續引用
- [ ] `wait` → 延遲執行
- [ ] `connector-db` → DB 連接器 (Mock 模式)

### 2.3 變數插值驗證

- [ ] `${step1.output.field}` — step 輸出引用
- [ ] `${env.NODE_ENV}` — 環境變數引用
- [ ] 巢狀引用 — 多層 step 串接

**Success Criteria**:
- [ ] 所有 API 端點回傳正確 HTTP status 和 JSON 結構
- [ ] 所有 step type 在 Linux 容器中可正確執行

---

## Stage 3: E2E UI/UX Tests — Playwright 瀏覽器自動化

**Goal**: 透過 Playwright 對 Docker 容器中的 production build 進行 UI 操作驗證
**Status**: Complete (54/54 tests PASS — e2e/tests/*.spec.ts)

### 3.0 測試架構調整

修改 `e2e/playwright.config.ts`，增加 Docker production 測試設定：

```typescript
// 新增 project: docker-production
{
  name: 'docker-production',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3001',  // Docker 容器 port
  },
}
```

### 3.1 Dashboard 頁面 UI/UX

**檔案**: `e2e/tests/dashboard.spec.ts`

- [ ] 首頁自動跳轉到 /dashboard
- [ ] 統計卡片 (Total / Active / Paused / Draft) 顯示且數值正確
- [ ] Workflow 列表顯示正確欄位 (名稱, 狀態, 更新時間)
- [ ] 「New Workflow」按鈕可開啟建立對話框
- [ ] 建立 Workflow 後自動跳轉到 Editor
- [ ] 點擊 Workflow 列表項目跳轉到 Editor
- [ ] 刪除 Workflow 後列表更新 (ConfirmDialog 流程)
- [ ] 空狀態顯示 (無 workflow 時的提示)
- [ ] 執行按鈕觸發執行 (無參數)
- [ ] 執行按鈕彈出 ExecuteDialog (有 inputParameters 時)

### 3.2 Editor 頁面 UI/UX

**檔案**: `e2e/tests/editor.spec.ts`

- [ ] Editor 載入並顯示 workflow 名稱
- [ ] 畫布 (StepCanvas) 渲染且可拖拉
- [ ] 新增 Station 功能正常
- [ ] 新增 Step 到 Station
- [ ] Step 節點 (StepNode) 顯示名稱和類型圖示
- [ ] 選取 Step 顯示設定面板
- [ ] 修改 Step 設定 (名稱、config 欄位)
- [ ] Save 按鈕觸發 API 呼叫且成功
- [ ] Save 後顯示成功 Toast
- [ ] Simulate 按鈕開啟 SimulationPanel
- [ ] SimulationPanel 顯示模擬結果
- [ ] 切換 Step type (trigger-manual, script-js, if-else 等)
- [ ] 版本歷史面板 (VersionHistoryPanel) 開關正常
- [ ] 刪除 Step/Station 操作

### 3.3 Executions 頁面 UI/UX

**檔案**: `e2e/tests/executions.spec.ts`

- [ ] Executions 頁面載入
- [ ] 執行歷史列表顯示 (workflow 名稱, 狀態, 時間)
- [ ] 點擊執行記錄顯示詳細結果
- [ ] 執行日誌 (logs) 正確顯示
- [ ] 篩選功能 (依狀態/workflow)
- [ ] 刪除執行記錄

### 3.4 Monitoring 頁面 UI/UX

**檔案**: `e2e/tests/monitoring.spec.ts`

- [ ] Monitoring 頁面載入
- [ ] Success Rate / Server Uptime / Active Schedules 卡片顯示
- [ ] Execution Trend 圖表渲染
- [ ] 數值與後端 /api/metrics 回傳一致

### 3.5 全流程 E2E Scenario

**檔案**: `e2e/tests/full-workflow.spec.ts`

完整使用者操作流程：

```
1. Dashboard → 建立新 Workflow
2. Editor → 新增 Station + 3 個 Steps (manual trigger → script-js → set-variable)
3. Editor → 設定各 Step config
4. Editor → Save
5. Editor → Simulate → 確認模擬結果
6. Editor → Execute → 確認執行成功
7. Executions → 查看執行結果和日誌
8. Dashboard → 確認統計更新
9. Dashboard → 刪除 Workflow → 確認清理
```

### 3.6 響應式 / 跨瀏覽器

- [ ] 桌面解析度 (1920x1080) 佈局正常
- [ ] 中等解析度 (1366x768) 佈局正常
- [ ] 導航列收合/展開
- [ ] 所有按鈕可點擊、無遮擋

**Success Criteria**:
- [ ] 所有 Playwright 測試在 Docker production build (port 3001) 上 PASS
- [ ] 截圖/錄影無視覺異常

---

## Stage 4: Docker Production 環境驗證

**Goal**: 驗證 Docker image 在 Linux 中的完整生產就緒度
**Status**: Partially Complete (build, startup, API, E2E verified)

### 4.1 建置驗證

```bash
docker build -t workflow-automation:test .
```

- [ ] Docker build 成功 (無錯誤)
- [ ] Image size 合理 (< 500MB)
- [ ] Multi-stage build 正確 (production image 不含 devDependencies)

### 4.2 容器啟動驗證

```bash
docker compose up -d
```

- [ ] 容器啟動無錯誤
- [ ] Health check 通過 (GET /api/health → 200)
- [ ] 10 秒內完成啟動 (start_period)
- [ ] 非 root 使用者執行 (UID 1001)
- [ ] /var/data 目錄可寫入 (SQLite)

### 4.3 既有 Production Test Script

```bash
docker run --rm workflow-automation:test bash /app/scripts/test-production.sh
```

- [ ] System Info 正確 (RHEL 8, Node 18, Python 3)
- [ ] Pre-flight checks 全過
- [ ] API smoke tests 全過
- [ ] Python execution 正常
- [ ] Frontend static files 正確提供
- [ ] Graceful shutdown 正常

### 4.4 持久化與重啟驗證

```bash
# 建立資料
docker compose up -d
curl -X POST http://localhost:3001/api/workflows -H 'Content-Type: application/json' \
  -d '{"name":"Persist Test","definition":{"stations":[]}}'

# 重啟容器
docker compose restart

# 驗證資料仍在
curl http://localhost:3001/api/workflows | grep "Persist Test"
```

- [ ] 重啟後資料持久化 (SQLite volume mount)
- [ ] 重啟後排程恢復

### 4.5 資源與穩定性

- [ ] 記憶體使用合理 (< 256MB idle)
- [ ] 無記憶體洩漏 (連續執行 50 次 workflow 後記憶體穩定)
- [ ] 並發請求不崩潰 (10 concurrent API calls)
- [ ] 日誌輸出正常 (Pino JSON format)

### 4.6 安全性基礎檢查

- [ ] 容器以非 root 執行
- [ ] 無不必要的 port 開放
- [ ] Node.js VM 沙箱隔離 (script-js 無法 require/process)
- [ ] Python subprocess 有 timeout
- [ ] SQL injection 防護 (prepared statements)

---

## Stage 5: 新增自動化測試腳本

**Goal**: 建立可重複執行的 Docker 測試腳本
**Status**: Complete (scripts/test-docker-full.sh)

### 5.1 Docker 測試入口腳本

新增 `scripts/test-docker-full.sh`：

```bash
#!/bin/bash
# 完整 Docker 測試流程
set -e

echo "=== Stage 1: Build Docker image ==="
docker build -t workflow-automation:test .

echo "=== Stage 2: Run unit tests in container ==="
docker run --rm workflow-automation:test sh -c \
  "cd /app/backend && npx vitest run 2>&1"

echo "=== Stage 3: Run production smoke tests ==="
docker run --rm workflow-automation:test bash /app/scripts/test-production.sh

echo "=== Stage 4: Start container for E2E ==="
docker compose -f docker-compose.test.yml up -d
sleep 10  # wait for healthy

echo "=== Stage 5: Run API integration tests ==="
node scripts/test-api-integration.js

echo "=== Stage 6: Run Playwright E2E ==="
cd e2e && npx playwright test --project=docker-production

echo "=== Stage 7: Cleanup ==="
docker compose -f docker-compose.test.yml down -v

echo "=== ALL TESTS PASSED ==="
```

### 5.2 需要新建的檔案

| 檔案 | 用途 |
|------|------|
| `scripts/test-docker-full.sh` | 完整 Docker 測試流程入口 |
| `scripts/test-api-integration.js` | API 整合測試 (Stage 2 詳細版) |
| `docker-compose.test.yml` | 測試專用 compose (臨時 volume) |
| `e2e/tests/dashboard.spec.ts` | Dashboard UI/UX 測試 |
| `e2e/tests/editor.spec.ts` | Editor UI/UX 測試 |
| `e2e/tests/executions.spec.ts` | Executions UI/UX 測試 |
| `e2e/tests/monitoring.spec.ts` | Monitoring UI/UX 測試 |
| `e2e/tests/full-workflow.spec.ts` | 全流程 E2E 場景 |

### 5.3 CI-ready Dockerfile.test (可選)

在 builder stage 加入測試步驟，確保 CI 中自動執行：

```dockerfile
# 在 builder stage 最後加入
RUN cd backend && npx vitest run
RUN cd frontend && npx vitest run
```

---

## 執行順序

```
Stage 1 (Unit Tests)
  └─ 可立即執行，修復任何 Linux 相容性問題
       │
Stage 2 (API Integration)
  └─ 需要 Docker image 建置完成
       │
Stage 4 (Docker Environment) ──── 與 Stage 2 同步進行
  └─ 建置/啟動/安全性驗證
       │
Stage 3 (E2E UI/UX)
  └─ 需要容器穩定運行後進行
       │
Stage 5 (Automation Scripts)
  └─ 將所有測試整合為一鍵執行
```

---

## 測試矩陣摘要

| 層級 | 工具 | 環境 | 測試數量(預估) |
|------|------|------|---------------|
| Unit (Backend) | Vitest | Docker (Linux) | ~12 files, 60+ cases |
| Unit (Frontend) | Vitest + jsdom | Docker (Linux) | ~3 files, 15+ cases |
| API Integration | curl / Node.js | Docker (Linux) | ~25 endpoints |
| E2E UI/UX | Playwright | Chrome → Docker | ~40 scenarios |
| Production Env | Shell script | Docker (Linux) | ~15 checks |
| **Total** | | | **~155+ test cases** |
