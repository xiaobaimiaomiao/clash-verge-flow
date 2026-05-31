# ClashFlow — Clash 规则管理浏览器扩展设计文档

## 项目概览

**项目名称**: ClashFlow — Clash 代理规则可视化 & 一键管理器 ✧

**核心理念**: 二次元风格的 Clash 代理规则可视化 + 一键管理浏览器扩展，直接与 Clash Meta Core 交互

**架构**: 浏览器扩展 (React + Tailwind)，通过 Clash Meta Core REST API 读取运行时配置 + 通过 Clash Verge Rev 内嵌 Bridge 服务直接写入 Profile 文件

```
Chrome Extension (React + Tailwind, Manifest V3)
    ↕ HTTP / WS (127.0.0.1:9090)        ← Clash Meta Core REST API（读取运行时）
    ↕ HTTP POST (127.0.0.1:33331)       ← Clash Verge Rev Bridge（写入规则 + 重载配置）

Clash Meta Core (verge-mihomo)
    ↕ 命名管道 / 配置文件
Clash Verge Rev (Tauri + React)
    └─ embed_server()  ← warp HTTP 服务 (singleton 端口)
         ├─ /commands/visible   (已有)
         ├─ /commands/scheme    (已有)
         ├─ /commands/pac       (已有)
         └─ /commands/extension/rules  (新增)
```

> Clash Verge Rev 在启动时已运行一个 warp HTTP 服务（singleton 端口 33331）。本扩展新增一个 `POST /commands/extension/rules` 路由，浏览器扩展可直接调用它将规则写入当前 Profile 的 rules 增强文件并触发热重载，无需手动粘贴配置。

---

## 目录结构

```
extension/                                 # Chrome Extension 独立目录（位于项目根目录）
├── manifest.json                          # Manifest V3
├── package.json
├── vite.config.ts                         # Vite 打包配置 + CRXJS
├── tailwind.config.js
├── tsconfig.json
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       ├── icon-128.png
│       └── icon-offline-48.png            # 离线状态图标
└── src/
    ├── background/
    │   └── service-worker.ts              # Service Worker：流量监控、Badge 更新、定时刷新
    ├── popup/
    │   ├── index.html
    │   ├── main.tsx
    │   ├── App.tsx                        # Popup 主页面 (路由容器)
    │   ├── pages/
    │   │   ├── Dashboard.tsx              # 主页仪表盘（概览）
    │   │   ├── CurrentSite.tsx            # 当前站点规则匹配详情
    │   │   ├── RuleManager.tsx            # 规则管理器（增删改排序）
    │   │   ├── ProxyPanel.tsx             # 代理节点/组切换面板
    │   │   ├── ConnectionLog.tsx          # 实时连接日志
    │   │   ├── ProfileSwitch.tsx          # 多 Profile 切换
    │   │   └── Settings.tsx               # 扩展设置（API 地址、Secret、主题）
    │   ├── components/
    │   │   ├── StatusBar.tsx              # 连接状态 + 看板娘
    │   │   ├── DomainCard.tsx             # 当前域名规则匹配卡片
    │   │   ├── RuleList.tsx               # 规则列表（分组折叠）
    │   │   ├── RuleEditor.tsx             # 规则编辑/新建表单
    │   │   ├── QuickAdd.tsx               # 一键添加当前域名规则
    │   │   ├── ProxySelector.tsx          # 代理组/节点选择器
    │   │   ├── DelayBadge.tsx             # 延迟标签（绿/黄/红）
    │   │   ├── TrafficChart.tsx           # 实时流量迷你图表
    │   │   ├── ConnectionRow.tsx          # 单条连接记录行
    │   │   ├── ProfileCard.tsx            # Profile 卡片（含订阅信息）
    │   │   ├── SakuraParticles.tsx        # 樱花粒子特效
    │   │   └── AnimatedBg.tsx             # 动态背景
    │   └── hooks/
    │       ├── useClashConfig.ts          # 获取 Clash 配置总览
    │       ├── useRules.ts                # 规则 CRUD hook
    │       ├── useRuleMatch.ts            # 当前域名匹配检测 hook
    │       ├── useProxyGroups.ts          # 代理组 hook
    │       ├── useConnections.ts          # 实时连接 WebSocket hook
    │       ├── useTraffic.ts              # 实时流量 WebSocket hook
    │       ├── useDelay.ts                # 节点延迟测试 hook
    │       └── useProfiles.ts             # Profile 列表 hook（读本地文件）
    └── shared/
        ├── api/
        │   └── clash.ts                   # Clash REST API 封装（统一请求层）
        ├── utils/
        │   ├── rule-parser.ts             # 规则字符串解析工具
        │   └── domain-extract.ts          # 从 URL 提取主域名/后缀
        └── types/
            └── clash.ts                   # Clash API 响应类型定义
```

---

## 与 Clash Meta Core 交互方式

本扩展直接调用 Clash Meta Core 已暴露的 REST API，无需任何中间层。

### 使用的 Clash REST API 端点

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/configs` | 获取当前 Clash 配置路径及基本信息 |
| GET | `/rules` | 获取完整规则列表 |
| GET | `/proxies` | 获取全部代理节点 + 代理组 |
| PUT | `/proxies/:name` | 切换代理组内选中的节点 |
| DELETE | `/connections/:id` | 关闭指定连接 |
| DELETE | `/connections` | 关闭所有连接 |
| GET | `/providers/proxies` | 获取代理 provider（订阅组） |
| PUT | `/providers/proxies/:name` | 触发订阅 provider 更新 |
| WS | `/connections` | 实时连接日志流 |
| WS | `/traffic` | 实时上下行流量 |
| WS | `/logs` | 实时 Clash 核心日志 |

### Secret 认证

Clash Meta Core 若配置了 `external-controller` 的 secret，本扩展需要用户在 Settings 页面手动填入并存储到 `chrome.storage.local`。每次请求追加 `Authorization: Bearer <secret>` 头。

---

## 功能模块详细设计

### 功能一：请求监听 & 批量规则添加

**核心体验**：Service Worker 实时监听所有浏览器请求，慢响应（>5 秒）或失败请求自动收集，支持一键勾选批量添加为规则。

- **Service Worker** 中注册 `chrome.webRequest` 三个监听器：
  - `onBeforeRequest` — 记录请求起始时间
  - `onCompleted` — 计算耗时，状态码 ≥500 或耗时 ≥5000ms 则记录为问题请求
  - `onErrorOccurred` — 网络错误（连接超时、DNS 解析失败、代理连接失败等）记录为问题请求
- 自动过滤本地地址 (127.x, 192.168.x, localhost) 和 Google 系统域名
- 问题请求存储在 Service Worker 内存中，最多保留 100 条
- Popup 通过 `chrome.runtime.sendMessage` 拉取问题列表，每 3 秒自动刷新

**问题请求展示**：
- **按域名分组视图**：同一域名的多次问题聚合显示，展示失败次数 / 慢响应次数 / 最近一次时间
- **按请求平铺视图**：每条请求独立展示方法、类型、耗时、状态码、错误信息
- 每条/每组请求前均有勾选框

**两种匹配模式**（全局 + 每域名独立切换）：
| 模式 | 规则类型 | 示例 URL `www.rapidseedbox.com` 生成规则 |
|------|----------|------------------------------------------|
| *.后缀匹配 | `DOMAIN-SUFFIX` | `DOMAIN-SUFFIX,rapidseedbox.com,代理组` |
| 完整域名 | `DOMAIN` | `DOMAIN,www.rapidseedbox.com,代理组` |

- 每行独立切换匹配模式，按钮显示实际生成的 payload
- 全局默认模式在顶部设置

**批量添加规则**：
1. 勾选目标域名/请求
2. 选择目标代理组（下拉列表来自 `/proxies`）
3. 点击「✧ 添加 N 条规则到 XXX」按钮
4. 自动去重（相同 type+payload 只算一条）
5. 通过 Clash Verge Rev 内嵌的 Bridge HTTP Server（`POST /commands/extension/rules`）直接写入当前 Profile 的 rules 增强文件（`prepend` 段，最高优先级）
6. Bridge Server 自动调用 `CoreManager::update_config_forced()` 热重载配置
7. 成功后清空问题列表 + ✧ sparkle 特效

### 功能二：代理节点 & 代理组管理

- 展示所有代理组（SELECT / FALLBACK / LOAD_BALANCE / URL_TEST）
- 每个代理组内展示节点列表，附延迟测试结果（绿 < 200ms，黄 200-500ms，红 > 500ms 或超时）
- 点击节点即切换，调用 `PUT /proxies/:groupName`
- 支持一键「测试全部延迟」按钮（`GET /group/:name/delay` 或 `/providers/proxies/:name/healthcheck`）
- 展示当前选中的节点高亮

### 功能三：实时连接日志面板

- 通过 `WS /connections` 订阅实时连接流
- 每条连接显示：目标域名/IP、目标国家、使用的代理链路、规则、上下行流量、持续时间
- 支持按域名/代理名搜索过滤
- 支持单条关闭连接（`DELETE /connections/:id`）和一键清空所有连接
- 连接超 50 条自动折叠旧条目，仅显示最近 50 条（可在设置中调整）

### 功能四：多 Profile 可视切换

> 由于浏览器无法直接访问文件系统，Profile 切换通过 Clash REST API 的 `PUT /configs`（传入新配置路径）实现。Profile 列表来源于 `GET /configs` 返回的当前路径信息 + 扩展本地存储的用户自定义 Profile 路径列表。

- 用户可在 Settings 页面添加多个 Profile 的 YAML 文件路径
- 展示 Profile 卡片列表，高亮当前激活的 Profile
- 点击切换 → `PUT /configs` 带上新的 `path` 字段
- 切换成功后自动关闭 Popup 并刷新状态

### 功能五：规则管理器（增删改 + 排序）

- 拉取当前完整规则列表，以分组折叠方式展示（按规则前缀或注释自动分组）
- 每条规则显示：规则类型图标、条件值、目标代理组、在文件中的序号
- 支持：
  - 搜索过滤规则（按域名/关键字）
  - 拖拽排序（使用 `@dnd-kit/sortable`，与 Clash Verge 主程序同款库）
  - 编辑规则（点击展开表单，修改后写回配置）
  - 删除规则（二次确认弹窗）
- 排序/增删变更后批量写回：通过 `PUT /configs` 重载使规则生效
- 由于 REST API 不直接支持规则文件的写操作，规则文件变更需要在 Clash Verge Rev 主程序中配合完成；扩展侧提供「导出变更建议」功能（生成 diff 或 patch 文件提示用户手动应用）

### 功能六：订阅更新 & 健康检查

- 显示代理 Provider 列表（`GET /providers/proxies`）
- 每个 Provider 显示：名称、节点数量、上次更新时间、节点类型
- 支持一键更新订阅（`PUT /providers/proxies/:name`）并显示进度
- 更新完成后自动触发健康检查，刷新所有节点延迟

### 功能七：实时流量仪表盘

- 通过 `WS /traffic` 获取上下行速率，绘制迷你折线图（最近 60 秒）
- 显示总上传/下载字节数（从连接日志累计）
- 当前活跃连接数
- 流量超过用户配置阈值时看板娘变为惊讶表情并发出提醒

### 功能八：扩展设置页

- Clash API 地址：默认 `127.0.0.1:9090`，可自定义
- Secret：加密存储到 `chrome.storage.local`
- 主题模式：深色/浅色/跟随系统（二次元风格）
- 看板娘表情强度：高/中/低
- 粒子特效开关
- 延迟测试目标：默认 `http://www.gstatic.com/generate_204`，可自定义
- 默认规则插入位置偏好

---

## 规则匹配引擎（扩展侧实现）

支持 Clash 主要规则类型：
- `DOMAIN` — 精确全域名匹配
- `DOMAIN-SUFFIX` — 后缀匹配
- `DOMAIN-KEYWORD` — 关键字包含检测
- `GEOIP` — GeoIP（浏览器侧基于 IP 匹配，需配合 `/connections` 返回的目标 IP）
- `IP-CIDR` / `IP-CIDR6` — CIDR 段匹配（使用 `cidr-block` 工具库，与 Clash Verge 主程序共享）
- `MATCH` — 兜底规则

匹配优先级：按规则列表顺序从上到下，第一条命中即返回，同时高亮显示该规则在所有规则中的位置。

---

## Chrome 扩展设计

### Manifest V3

```json
{
  "manifest_version": 3,
  "name": "ClashFlow ✧",
  "version": "1.0.0",
  "description": "Clash 代理规则可视化 & 一键管理器 ✧",
  "permissions": ["activeTab", "storage", "tabs", "webRequest"],
  "host_permissions": [
    "http://127.0.0.1:9090/*",
    "http://127.0.0.1:33331/*",
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": "public/icons/icon-48.png"
  },
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  }
}
```

### 二次元 UI 设计指南

**视觉风格**：
- 主色调: 樱花粉 `#FFB7C5` + 天空蓝 `#87CEEB` + 薰衣草紫 `#E6E6FA`
- 背景: 深色带微光粒子 (模拟星空) + 漂浮樱花花瓣
- 字体: "Noto Sans SC" (中文) + "M PLUS Rounded 1c" (日文风)
- 看板娘: 小精灵显示连接状态
  - 连接正常且有节点可用 → 开心 "连接成功啦~♪"
  - 延迟过高 (>500ms) → 惊讶 "延迟好高呀！"
  - API 无法连接 → 哭泣 "呜呜...Clash 好像没在运行..."
  - 规则添加成功 → 转圈撒花 "加好啦~✧"
  - 流量突增 → 瞪大眼 "流量用好多了哦~"
- 动画:
  - 樱花粒子飘落背景
  - 页面切换有滑入/滑出过渡
  - 卡片展开/收拢有弹簧动画
  - 按钮 hover 有发光 + 弹性效果
  - 规则添加成功时 ✧ sparkle 爆炸特效
  - 延迟数字根据速度变色（绿→黄→红过渡动画）

### Popup 布局 (宽 400px, 高 600px)

```
┌──────────────────────────────┐
│ ✧ ClashFlow        [⚙] [⟳] │ ← 顶栏 + 设置 + 重载按钮
├──────────────────────────────┤
│  [Mascot] 连接中~♪          │ ← 看板娘状态栏
│  ↑ 2.4MB/s  ↓ 312KB/s      │ ← 实时流量迷你数字
├──────────────────────────────┤
│  [概览] [站点] [规则] [...更多] │ ← Tab 导航栏
├──────────────────────────────┤
│                              │
│       (各子页面内容区域)       │
│                              │
└──────────────────────────────┘
```

### Service Worker 职责

- **请求监听（核心）**：`chrome.webRequest` 三件套 (`onBeforeRequest`, `onCompleted`, `onErrorOccurred`)
  - 记录请求计时 → 完成时计算耗时 → ≥5000ms 或 HTTP ≥500 归为问题请求
  - 网络错误（连接超时、DNS 失败、代理失败等）归为问题请求
  - 自动过滤本地地址 + 系统域名
  - 问题请求存储在内存，上限 100 条，供 Popup 通过 `chrome.runtime.onMessage` 拉取
- 每 30 秒轮询 `/proxies`，更新 Badge 文字（显示当前节点名称缩写）
- 每 10 秒更新 Badge 为未处理的问题请求数量（黄色）
- 监听 `WS /traffic`，当流量超过阈值时动态更新 Badge 颜色为橙色
- API 不可达时自动切换为灰色离线图标

### 技术栈

| 组件 | 技术 |
|------|------|
| 打包工具 | Vite + CRXJS (crxjs/vite-plugin) |
| UI 框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 3 + 自定义二次元主题 |
| 动画 | Framer Motion + CSS Animations |
| HTTP/WS | fetch + 原生 WebSocket |
| 状态管理 | Zustand |
| 拖拽 | @dnd-kit/sortable（与 Clash Verge 主程序一致） |
| IP 工具 | cidr-block（与 Clash Verge 主程序共享依赖） |

---

## 开发阶段

### Phase 1: 基础框架 & API 层
- 搭建 Vite + CRXJS 项目骨架
- 封装 Clash REST API 统一请求层（含 Secret 认证、错误处理）
- 实现 Popup Shell：顶栏、看板娘状态栏、Tab 导航
- Settings 页面：配置 API 地址 + Secret，测试连通性

### Phase 2: 核心功能
- Dashboard：连接状态、流量数字、活跃连接数
- CurrentSite：当前域名匹配可视化 + 一键添加规则
- ProxyPanel：代理组/节点列表 + 延迟测试 + 切换
- RuleList：规则分组展示 + 搜索过滤

### Phase 3: 高级功能
- ConnectionLog：WebSocket 实时连接流 + 搜索 + 关闭连接
- ProfileSwitch：Profile 卡片列表 + `PUT /configs` 切换
- SubscriptionProvider：订阅健康检查 + 一键更新
- TrafficChart：60 秒流量折线图

### Phase 4: 打磨 & 动效
- 樱花粒子 / sparkle 特效
- 看板娘全状态表情集
- 深色/浅色主题切换
- 页面路由动画
- 扩展品牌图标设计

---

## 与 Clash Verge Rev 的协作关系

本扩展定位为 Clash Verge Rev 的「浏览器伴侣」，不重复核心功能，专注于浏览器上下文中独有的便利操作：

| 能力 | Clash Verge Rev 主程序 | ClashFlow 扩展 |
|------|------------------------|----------------|
| 规则编辑 | ✅ 完整 YAML 编辑器 | ✅ 快速添加/删除当前站点规则 |
| 代理切换 | ✅ 完整界面 | ✅ Popup 快速切换 |
| 连接日志 | ✅ 完整 | ✅ 精简实时流 |
| 订阅管理 | ✅ 完整 | ✅ 一键更新 + 健康检查 |
| 当前站点分析 | ❌ 无感知 | ✅ 自动识别当前 Tab 域名 |
| Profile 管理 | ✅ 完整 | ✅ 快速切换 |
| 配置重载 | ✅ | ✅ Popup 一键触发 |

---

## Clash Verge Rev Bridge Server

浏览器扩展无法直接访问文件系统，因此通过 Clash Verge Rev 内嵌的 HTTP 服务实现规则写入。Clash Verge Rev 在启动时会自动运行一个 warp HTTP 服务（即 singleton 服务器，默认端口 33331）。

### 新增路由

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/commands/extension/rules` | 将新规则写入当前 Profile 的 rules 增强文件并热重载 |

### 请求格式

```json
POST /commands/extension/rules
Content-Type: application/json

{
  "rules": [
    "DOMAIN-SUFFIX,rapidseedbox.com,PROXY",
    "DOMAIN,api.example.com,REJECT"
  ]
}
```

### 处理流程

1. 解析请求中的规则字符串数组
2. 获取当前激活 Profile 的 `option.rules` UID
3. 若 rules 增强文件不存在，自动生成 `r{UID}.yaml` 并写入默认模板（`preload: [], append: [], delete: []`），同时更新 Profile Item 的 `option.rules` 字段
4. 读取 rules 增强文件、解析为 `SeqMap`、将新规则 prepend 到最前
5. 写回文件
6. 调用 `CoreManager::global().update_config_forced()` 触发完整的 enhance 流程 + 热重载到 mihomo 核心
7. 返回 `{ ok: true, count: N, uid: "..." }`

### 响应格式

成功：`200 OK`
```json
{ "ok": true, "count": 2, "uid": "rAbCdEfGhIjK" }
```

失败：`500 Internal Server Error`
```json
{ "error": "failed to write rules file: Permission denied" }
```

### 与 CORS

Bridge Server 配置了 `allow_any_origin()` + `allow_methods(["GET","POST","PUT","DELETE"])` + `allow_headers(["Content-Type","Authorization"])` 以支持从 Chrome Extension 上下文发起的 cross-origin 请求。

---

## 安全注意事项

- Clash API 仅请求 `127.0.0.1`（默认 9090 端口），不向任何外网发送数据
- Secret 加密存储到 `chrome.storage.local`，不记录日志
- 不读取或暴露代理服务器密码、UUID、SNI 等敏感字段（在 UI 中脱敏显示）
- `webRequest` 权限仅用于**监听请求元数据**（URL、状态码、耗时），**不拦截、不修改、不读取请求/响应体**
- 问题请求仅存储在 Service Worker 内存中，不持久化，Service Worker 休眠即清空
- `<all_urls>` host_permission 仅服务于 webRequest 监听，不向外部上传任何数据
- Manifest 使用最小权限原则

---

## 后续可扩展

- 规则 import/export 为外部文件（一键分享规则集）
- 规则冲突检测（同一域名出现在多条规则中的告警）
- 基于历史的智能规则推荐（记录用户频繁手动添加的规则）
- Side Panel 模式（新版 Chrome 侧边栏常驻，展示全量数据）
- 键盘快捷操作（`Alt+Shift+C` 打开 Popup）
- 多语言支持（简/繁中、英、日）复用 Clash Verge 已有的 i18next 体系
- 与 Clash Verge 主程序共享 Profile 列表（通过本地文件约定路径或 Tauri 自定义协议桥接）
