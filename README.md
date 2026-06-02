# LLM Proxy Gateway

轻量级本地模型 API 代理工具，用于归集多个供应商的 API。

## 核心需求

### 1. 模型别名 + 负载均衡
- 一个模型别名可映射到多个供应商
- 负载均衡基于**授权（Auth）级别**进行
- 分配优先级：按各授权的月额度比例 / 总月 token 额比例智能分配
- 决策供应商是否可用：遵循限流规则逻辑（AND 逻辑，任一超限即等待）

### 2. 供应商池 + 授权均衡
- 供应商定义：模型列表、限流规则、Header 配置等（共享配置）
- 授权定义：单个 API Key，独立统计、独立限流判定
- 一个供应商可配置多个授权（多个 Key），这些 Key 共享相同的模型和限流规则
- 负载均衡在授权级别执行（不是供应商级别）
- 当池中所有授权均不可用（触发限流），请求进入等待队列，等待超时时间可配置

### 3. 供应商级限流（可叠加，AND 逻辑）
限流规则配置在**供应商级别**，但判定和执行在**授权级别**：
- **按次数**：每 5 小时 / 周 / 月 最大请求次数
- **按 Token 量**：每月最大 Token 总量
- **按并发**：最大并发请求数
- **按 TPM**：每分钟 Token 数限制

多种规则**同时生效（AND）**，任一触发即判定该授权不可用。

### 4. 格式处理（全部支持）
- 自动检测请求格式类型（/chat/completions、/messages、/responses）
- 若授权对应的供应商支持该格式：直接透传
- 若不支持：自动补充/转换格式
- 支持所有格式间转换：
  - chat/completions ↔ messages
  - chat/completions ↔ responses
  - messages ↔ responses
- 支持自定义请求头（新增/修改 Header）

### 5. 用量统计（独立于限流）
统计不受限流配置控制，所有请求必须记录：
- **按次统计**：每 5 小时 / 周 / 月 各用了多少次（按授权粒度）
- **按 Token 统计**：每小时（日/月同理）输入 token / 输出 token / 缓存 token 用量（按授权粒度）

### 6. 配置与存储分离
- **日志/统计**：入库（SQLite + Kysely）
- **配置**：不入数据库，使用 YAML 文件
- **模型配置** 与 **授权配置** 分离，方便用户独立管理：
  - `models.yaml`：模型别名、供应商映射、策略
  - `providers.yaml`：供应商配置（限流规则、Header 等）
  - `auths.yaml`：授权配置（API Keys、配额等）

### 7. 简洁设计
- 避免过度复杂的功能
- 轻量级部署

## 概念层级

```
模型别名 (Model Alias)
  └── 供应商池 (Provider Pool)
        ├── 供应商 A (Provider)
        │     ├── 共享配置：模型列表、限流规则、Header
        │     ├── 授权 1 (Auth: key=sk-xxx1)
        │     ├── 授权 2 (Auth: key=sk-xxx2)
        │     └── 授权 3 (Auth: key=sk-xxx3)
        └── 供应商 B (Provider)
              ├── 共享配置：...
              ├── 授权 1 (Auth: key=sk-yyy1)
              └── 授权 2 (Auth: key=sk-yyy2)
```

## 技术架构

### 技术栈
- **语言**: TypeScript (latest)
- **运行时**: Node.js + Bun (双支持)
- **包管理**: Yarn Workspaces (Monorepo)

### 后端
- **框架**: Hono (latest)
- **数据库**: SQLite + Kysely + kysely-codegen（仅用于日志和统计）
- **SQLite 驱动**: better-sqlite3 (Node) / bun:sqlite (Bun)

### 前端
- **框架**: Vue 3 (latest) + Reka UI
- **样式**: UnoCSS (无手写 CSS)
- **状态管理**: 不用 Pinia/Vuex，使用 Vue provide/inject + composables
- **构建**: Vite (latest)

### 工具链
- **Lint**: oxlint
- **Format**: oxformat (或 biome)
- **构建后端**: tsdown
- **类型检查**: tsc

### 架构设计
```
前端 SPA (Vue 3 + Reka UI + UnoCSS)
  └── REST API
        └── Hono 后端
              ├── API Router (OpenAI兼容端点)
              ├── Provider Pool (授权级负载均衡)
              ├── Rate Limiter (多规则叠加限流，AND逻辑)
              ├── Format Transformer (全格式转换)
              ├── Stats Collector (独立统计)
              ├── Kysely + SQLite (日志/统计数据层)
              └── Config Manager (YAML配置热重载)
```

### 扩展性考虑
- API 设计遵循 OpenAPI 规范，便于未来客户端集成
- 前后端完全分离，支持独立部署
- 插件化架构设计（限流器、格式转换器可插拔）
- Kysely 类型安全，kysely-codegen 自动生成 TypeScript 类型

## 配置示例

### models.yaml
```yaml
gpt-4:
  alias: my-smart-model
  providers:
    - provider_a
    - provider_b
  strategy: proportional  # proportional | round_robin | random
```

### providers.yaml
```yaml
provider_a:
  base_url: https://api.openai.com
  models: [gpt-4, gpt-3.5-turbo]
  rate_limits:
    - type: requests
      period: 5h
      max: 100
    - type: requests
      period: month
      max: 10000
    - type: tokens
      period: month
      max: 1000000
    - type: concurrency
      max: 5
    - type: tpm
      max: 50000
  queue_timeout: 30s
  headers:
    X-Custom-Header: value
```

### auths.yaml
```yaml
provider_a:
  - key: sk-xxx1
    monthly_quota: 100  # 用于负载均衡权重
  - key: sk-xxx2
    monthly_quota: 200
  - key: sk-xxx3
    monthly_quota: 100
```

## 项目结构
```
llm-proxy-gateway/
├── README.md
├── package.json              # root workspace config
├── yarn.lock
├── tsconfig.base.json        # shared tsconfig
├── oxlint.json
├── packages/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts          # 入口 (Node/Bun 兼容)
│   │   │   ├── server.ts         # Hono server
│   │   │   ├── config/
│   │   │   │   ├── models.ts     # 模型配置加载
│   │   │   │   ├── providers.ts  # 供应商配置加载
│   │   │   │   └── auths.ts      # 授权配置加载
│   │   │   ├── db/
│   │   │   │   ├── client.ts     # Kysely + SQLite
│   │   │   │   └── schema.ts     # 日志/统计 schema
│   │   │   ├── pool.ts           # 供应商池 + 授权均衡
│   │   │   ├── rate_limiter.ts   # 限流器
│   │   │   ├── stats.ts          # 统计收集器
│   │   │   ├── transformer.ts    # 格式转换
│   │   │   └── types.ts          # 业务类型
│   │   └── tests/
│   ├── frontend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── uno.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── composables/
│   │       ├── components/
│   │       ├── views/
│   │       └── api/
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── types.ts          # 前后端共享类型
│           └── api.ts            # OpenAPI schema
└── config/                      # 运行时配置目录
    ├── models.yaml
    ├── providers.yaml
    └── auths.yaml
```

## 下一步
- [ ] 确认角色分配方案
- [ ] 设计限流器算法
- [ ] 设计格式转换策略
- [ ] 初始化 monorepo 项目
- [ ] 开始编码