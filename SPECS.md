# LLM Proxy Gateway — 需求规格文档

> 本文档记录所有已确认的需求细节，供开发 agent 参考。

---

## 1. 核心概念层级

```
模型别名 (Model Alias)
  └── 供应商池 (Provider Pool)
        ├── 供应商 A (Provider)
        │     ├── 共享配置：模型列表、限流规则、Header
        │     ├── 授权 1 (Auth): key=sk-xxx1, name=主key
        │     └── 授权 2 (Auth): key=sk-xxx2, name=备用key
        └── 供应商 B (Provider)
              ├── 共享配置
              ├── 授权 1 (Auth)
              └── 授权 2 (Auth)
```

### 关键原则
- **限流规则配置在供应商级别**（多条规则，AND 逻辑），但**判定和执行在授权级别**（每个 key 独立统计、独立判定）
- **统计完全独立于限流**，所有请求必须记录
- **负载均衡在授权级别执行**
- **配置不入数据库**，使用 YAML 文件

---

## 2. 模型别名 + 负载均衡

### 2.1 模型别名 (Model Alias) 设计
- **别名** 是请求方使用的模型标识符 (如 `my-model`)
- **真实模型** 是供应商实际的模型名 (如 `gpt-4`, `claude-sonnet-4`)
- 一个别名 = 指定供应商的指定真实模型（一对多：一个别名可对应多个供应商的模型）
- 请求格式：`{ "model": "my-model", ... }` → 内部路由到配置的供应商真实模型
- 别名必须全局唯一

#### 别名映射规则
```yaml
models.yaml:
  my-smart-model:
    provider: provider_a
    model: gpt-4
    strategy: proportional
  my-fast-model:
    provider: provider_b
    model: claude-haiku
    strategy: round_robin
```

### 2.2 别名自动创建
- 在供应商页面添加模型时，如果用户不指定别名，自动创建一个跟模型名一样的别名
- 例如：添加 `gpt-4` 模型到 `provider_a`，不填别名 → 自动创建别名 `provider_a/gpt-4` 或 `gpt-4`

### 2.3 两种等效交互
- **从别名出发**（模型管理页）：创建别名 → 选择供应商 → 选择该供应商的具体模型
- **从供应商出发**（供应商管理页）：添加模型到供应商 → 填写模型名 → 可选映射到别名
- 两种方式最终写入相同的配置，保持数据一致性

### 2.4 模型选择方式
- 模型不是文本输入框，是**列表/下拉选择**
- 在别名创建时，先选供应商 → 自动加载该供应商支持的模型列表 → 选择具体模型

### 2.5 分配策略
- `priority`: 按列表顺序优先使用第一个可用授权（主备方案）
- `round_robin`: 轮询分配（多 key 均摊）
- `proportional`: 取每条授权下所有限流规则中**使用率最高**的那条（瓶颈规则），再选瓶颈最宽松的授权
- `random`: 随机
- `least_loaded`: 选当前并发数最低的授权
- 决策供应商是否可用：遵循限流规则逻辑

### 2.6 等待队列
- 当请求的目标别名下**所有供应商的授权均不可用**（触发限流），请求进入等待队列
- 等待超时时间配置在别名级别 (`queue_timeout`)
- 超时后返回 503 错误

### 2.7 会话亲和性 (Session Affinity)
- 同一个会话（同一 client session）的连续请求固定到同一个供应商/授权
- 检测以下请求头作为会话 ID（按优先级）：
  - `x-claude-code-session-id` (Claude Code 原生)
  - `x-conversation-id` (通用约定)
  - `x-session-id` (通用)
  - `x-request-id` (OpenAI SDK, Azure)
  - `openai-conversation-id` (OpenAI)
  - `x-correlation-id` (通用 API)
- 首次请求正常负载均衡，选中后将该会话 ID 绑定到该授权
- 后续同一会话的请求直接复用绑定的授权，不走均衡
- 默认启用，可在 models.yaml 中按别名关闭：`session_affinity: false`
- 原理：`Pool.selectAuth(sessionId)` → 查 Map → 命中则直接返回

---

## 3. 供应商级限流 (AND 逻辑)

### 3.1 限流规则类型（可叠加）
多种规则**同时生效（AND）**，任一触发即判定该授权不可用：

| 类型 | 说明 | 示例 |
|------|------|------|
| `weighted_requests` | 按请求倍率量限制（实际次数 × 模型 weight） | 每 5h 最多 100 请求倍率量 |
| `tokens` | 按 Token 总量限制 | 每分钟最多 50,000 token |
| `concurrency` | 最大并发请求数 | 最多 5 个并发 |

### 3.2 时间周期
- `weighted_requests` 时间周期：`5h` (每 5 小时)、`week` (周)、`month` (月)
- `tokens` 时间周期：`minute` (每分钟)、`5h` (每 5 小时)、`day` (天)、`month` (月)
- `concurrency` 无时间周期

### 3.3 限流执行
- 配置在 `providers.yaml`（供应商级别）
- **每个授权独立统计、独立判定**（授权级别）
- 授权 key 在 `providers.yaml` 内嵌入，不单独文件

---

## 4. 格式处理

### 4.1 支持的格式
- `/chat/completions` (OpenAI 标准)
- `/messages` (Anthropic)
- `/responses` (OpenAI Responses API)

### 4.2 处理逻辑
1. 自动检测请求格式类型
2. 若授权对应的供应商支持该格式：直接透传
3. 若不支持：自动补充/转换格式
4. **全格式间转换必须支持**：
   - chat/completions ↔ messages
   - chat/completions ↔ responses
   - messages ↔ responses

### 4.3 Header 处理
- 支持自定义请求头（新增/修改 Header）
- 配置在两个层级，转发时**合并**（模型别名级覆盖供应商级同名头）：
  - **供应商级** `providers.yaml#/provider/headers` — 该供应商所有模型共享
  - **模型别名级** `models.yaml#/alias/headers` — 仅该别名生效
- 网关转发顺序：`provider.headers` → `model.headers` 覆盖 → 协议头（x-api-key/Authorization）覆盖

---

## 5. 用量统计（独立于限流）

### 5.1 统计原则
- **不受限流配置控制**
- 所有请求必须记录，无论是否被限流

### 5.2 按次统计
- 粒度：每 5 小时 / 周 / 月
- 按授权粒度统计
- 内容：请求次数

### 5.3 按 Token 统计
- 粒度：每小时（日/月同理）
- 按授权粒度统计
- 内容：
  - 输入 token (input_tokens)
  - 输出 token (output_tokens)
  - 缓存 token (cache_tokens)

### 5.4 存储
- 使用 SQLite + Kysely
- 仅日志和统计入库
- 配置不入数据库

---

## 6. 配置文件设计

### 6.1 合并设计

`config.yaml` 为唯一配置入口，不包含敏感信息：

```yaml
# config.yaml — 可公开分发
providers:
  provider_a:
    base_url: ...
    models: [...]
    ...

model_aliases:
  my-alias: ...
```

- `providers` 段：供应商配置（不含 API Keys）
- `model_aliases` 段：模型别名映射
- **API Keys 存储在 SQLite 数据库 `provider_auths` 表中**，通过独立授权管理界面 CRUD
- 授权创建时需选择目标供应商，一个供应商可有多个 key
- 启动时从 DB 加载所有 auth 注入内存

之前独立的 `providers.yaml` 和 `models.yaml` 已合并废弃。

### 6.3 计费模型 (pricing_model)

供应商有四种计费模式可选：

#### 选项 0：不计费（no_billing）
- 不记录任何费用
- 模型行只显示模型名 + 别名
- 不在 Dashboard 成本统计中出现
- 适用于免费或自建服务

#### 选项 1：按请求倍率计费（per_request_weighted）
- 填 1x 加权单价（即 weight=1 时的每次请求价格）
- 计算：费用 = 请求次数 × 模型 weight × 1x 单价

```yaml
provider_a:
  pricing_model: per_request_weighted
  unit_price: 0.001   # 1x 加权每次请求单价
```

#### 选项 2：按模型单价（per_model_token）
- 直接使用模型自己的 input_price / output_price 计算
- 不需要额外配置

```yaml
provider_b:
  pricing_model: per_model_token
  models:
    - name: gpt-4o
      input_price: 2.5    # $/M tokens
      output_price: 10    # $/M tokens
```

#### 选项 3：按包（subscription）
- 固定总价，包月或包年
- 包含一定数量的请求倍率量（weighted_requests）
- 超出套餐部分按 overage_unit_price 计费
- **自动联动限流规则**：保存时自动生成一条与订阅周期和数量匹配的限流规则（只读，不可手动修改）
- 可选择"不限制"（unlimited），不计调用次数

```yaml
provider_c:
  pricing_model: subscription
  subscription:
    price: 100                    # 固定总价
    period: month                 # month | year
    billing_type: unlimited       # unlimited | weighted_requests | tokens
    # 按请求倍率量计费：
    included_requests: 10000      # 套餐包含的请求倍率量
    overage_unit_price: 0.002     # 超出后单价
    # 按 token 计费（超出用模型自身 input/output price）：
    # included_tokens: 1000000    # 套餐包含的 token 数
```

#### providers.yaml（主文件）
```yaml
provider_a:
  base_url: https://api.openai.com
  api_format: openai_chat       # openai_chat | anthropic_messages | openai_responses
  models:
    - name: gpt-4
      alias: my-smart-model   # 可选，不填则自动创建
      weight: 2               # 请求加权倍率，默认 1
      input_price: 10.0       # 输入价格（per million tokens）
      output_price: 30.0      # 输出价格（per million tokens）
    - name: gpt-3.5-turbo
      weight: 1
  rate_limits:                # 多种限流规则，AND 逻辑，全在供应商级别配置
    - type: weighted_requests           # 按请求倍率数（实际次数 × 请求倍率）
      period: 5h
      max: 100
    - type: tokens             # 按 Token 总量
      period: month
      max: 1000000
    - type: concurrency        # 最大并发
      max: 5
    - type: tpm                # 每分钟 Token 数
      max: 50000
  headers:
    X-Custom-Header: value
  auths:                       # 授权 = 供应商的 API Key
    - key: sk-xxx1
      name: 主key
    - key: sk-xxx2
      name: 备用key
```

#### models.yaml（独立文件，但也可从 providers.yaml 推导）
```yaml
my-smart-model:
  provider: provider_a
  model: gpt-4
  weight: 2              # 可选，该模型的请求倍率（默认 1）
  strategy: proportional
  queue_timeout: 30s    # 所有供应商不可用时的等待超时
  session_affinity: true  # 会话亲和性，默认 true
```

---

## 7. 仪表盘设计

### 7.1 概览卡片（4 个）

1. **请求倍率量（所有 provider 合计，含本周期环比）**
   - 单位：次
   - 显示环比变化百分比
2. **本月总花费（按计价模型分别计算后合计）**
   - 单位：USD
3. **限流次数**
   - 单位：次
4. **活跃授权 / 总授权**
   - 格式：`6 / 8`

### 7.2 授权消耗排行

- **表格**：授权 Key | 供应商 | 请求倍率量 | 费用 | 限流状态
- 按费用或请求倍率量降序排列

### 7.3 API 响应格式

```json
{
  "success": true,
  "data": {
    "total_cost": 45.67,
    "total_requests": 12500,
    "total_rate_limited": 23,
    "by_pricing_model": {
      "per_request_weighted": {
        "label": "按请求倍率",
        "rows": [
          {
            "provider_id": "provider_a",
            "weighted_requests": 8000,
            "cost": 8.0,
            "unit_price": 0.001,
            "rate_limited": 2,
            "auths": [
              {
                "auth_key": "sk-adm...9i0j",
                "auth_name": "Admin Key",
                "limits": [
                  { "type": "weighted_requests", "period": "5h", "used": 80, "max": 100, "remaining": 20, "usage_pct": 80 },
                  { "type": "tokens", "period": "month", "used": 500000, "max": 1000000, "remaining": 500000, "usage_pct": 50 }
                ]
              }
            ]
          }
        ],
        "total_weighted_requests": 8000,
        "total_cost": 8.0,
        "total_rate_limited": 2
      }
    },
    "rate_limited_auths": []
  }
}
```

### 7.4 可展开行交互

每个计费模式区块的供应商行可点击展开，显示该供应商下所有授权（Auth）的限流规则进度条。默认折叠，点击行展开（一级展开，不嵌套）。

---

## 8. 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript (latest) |
| 运行时 | Node.js + Bun (双支持) |
| 包管理 | Yarn Workspaces (Monorepo) |
| 后端框架 | Hono (latest) |
| 数据库 | SQLite + Kysely + kysely-codegen |
| 前端框架 | Vue 3 (latest) + Reka UI |
| 样式 | UnoCSS (无手写 CSS) |
| 状态管理 | composables + provide/inject (不用 Pinia/Vuex) |
| 构建 | Vite (latest) + tsdown |
| 测试 | Vitest |
| Lint | oxlint |
| Format | biome / oxformat |

---

## 9. Agent 角色分工

| 角色 | 职责 |
|------|------|
| **后端开发** | Hono 服务器、配置加载、供应商池、限流器、格式转换、统计模块、Kysely、**后端单元测试** |
| **前端开发** | Vue 3 SPA、Reka UI、UnoCSS、配置管理界面、统计面板、API 对接、**前端组件测试** |
| **测试工程师** | API 接口测试、集成测试（mock 上游供应商）、E2E 联调测试 |

---

## 10. 项目结构

```
llm-proxy-gateway/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── SPECS.md                  # 本文件
├── package.json
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── schemas/      # Zod schemas
│   │   │   ├── types.ts
│   │   │   └── api.ts
│   │   └── tests/
│   ├── mock-api/
│   ├── backend/
│   └── frontend/
│       └── src/
│           ├── views/        # 5 个页面视图
│           ├── components/
│           └── composables/
└── config/
    ├── config.yaml              # 统一配置（可公开分发，无敏感信息）
    └── models.yaml              # 【已废弃，合并到 config.yaml】
```

---

## 11. TDD + API Schema 方案

- 使用 Zod 定义 API Schema (参考 openclaw-admin)
- Schema 定义在 `packages/shared/schemas/`
- 每个 Schema 必须有对应测试
- 前后端共享 Schema 和类型

---

## 12. 已确认设计决策

| 决策点 | 选择 |
|--------|------|
| 限流逻辑 | AND（任一超限即不可用） |
| 限流规则配置层级 | 供应商级别（多种规则，无独立 quota 概念，tokens 只是规则之一） |
| 限流判定执行层级 | 授权级别（每个 key 独立统计、独立判定） |
| 负载均衡策略 | priority, round_robin, proportional (按使用率), random, least_loaded |
| 格式转换 | 全部支持（chat ↔ messages ↔ responses） |
|| 队列超时所有权 | 模型别名级别（所有供应商不可用时的等待超时） |
|| 配置存储 | config.yaml（可公开分发）+ SQLite（auths） |
|| 授权 (Auth) | 供应商的 API Key，存数据库，通过独立授权页 CRUD，创建时选供应商 |
|| API Keys 存放 | SQLite `provider_auths` 表，不在 YAML 也不在供应商表单中 |
|| 模型选择 | 列表下拉选择，非文本输入 |
| 别名自动创建 | 未指定时自动生成 |
| 日志统计 | SQLite + Kysely |
| 前端状态管理 | composables + provide/inject |
| 样式方案 | UnoCSS (无手写 CSS) |
| 测试框架 | Vitest (全项目统一) |
| 汇率管理 | 全局汇率 API + SQLite 缓存 + 用户偏好货币 |
| 供应商货币 | 供应商/订阅可配 `currency` 字段，默认 USD |
| 前端货币显示 | 所有金额按用户偏好货币换算显示，输入框 placeholder 实时更新 |
| 会话亲和性 | 默认开启，按别名配置 `session_affinity`，检测 6 种常见会话头 |

---

## 13. 缓存计费 (Cache Pricing)

### 13.1 背景

上游 API 返回值中包含缓存命中和建立缓存的 token 数：
- **OpenAI 格式** (DeepSeek, StepFun)：`prompt_cache_hit_tokens`（缓存命中）、`prompt_cache_miss_tokens`（未命中，即正常输入）
- **Anthropic 格式** (IKunCode)：`cache_creation_input_tokens`（首次写入缓存）、`cache_read_input_tokens`（读取缓存）

缓存命中价比正常输入价便宜很多（IKunCode 低至 1/10），建立缓存价通常与输入价相近或略高。

### 13.2 模型级缓存价格字段

每个模型新增两个可选字段，仅在 `per_model_token` 计费模式下生效：

| 字段 | 类型 | 含义 | 不填时 |
|------|------|------|--------|
| `cache_hit_price` | number·optional | 缓存命中时的输入单价（¥/M tokens） | 等于 `input_price`（无折扣） |
| `cache_create_price` | number·optional | 建立缓存时的输入单价（¥/M tokens） | 等于 `input_price`（无折扣） |

### 13.3 上游缓存字段映射

网关从上游响应中提取缓存 token：

| API 格式 | cache_hit_tokens 来源 | cache_create_tokens 来源 |
|----------|----------------------|--------------------------|
| `openai_chat` | `usage.prompt_cache_hit_tokens` | 无（只分 hit/miss） |
| `anthropic_messages` | `usage.cache_read_input_tokens` | `usage.cache_creation_input_tokens` |

未中命的输入 token 数 = `input_tokens - cache_hit_tokens - cache_create_tokens`。

### 13.4 成本计算

`per_model_token` 模式下，单次请求成本：

```
cost = (未命中输入 × input_price + 缓存命中 × cache_hit_price + 建立缓存 × cache_create_price + 输出 × output_price) / 1_000_000
```

如果模型没有配置 `cache_hit_price` / `cache_create_price`，对应部分按 `input_price` 计算（即无折扣）。

`per_request_weighted` 和 `subscription` 模式不涉及缓存计费。

### 13.5 数据库扩展

`request_logs` 表新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `cache_hit_tokens` | integer·default(0) | 缓存命中 token 数 |
| `cache_create_tokens` | integer·default(0) | 建立缓存 token 数 |

（现有 `cache_tokens` 字段保留，用于快速合计或兼容）

### 13.6 前端

- 供应商编辑弹窗的模型列表中，缓存价输入框在以下条件同时满足时显示：
  - 计费方式为 `per_model_token` **或** `subscription` + `billing_type=tokens`
  - 且模型的 `input_price` 有值
- 显示在输入价/输出价之后：
  - **缓存命中价** (`cache_hit_price`) — placeholder: "不填=输入价"
  - **建立缓存价** (`cache_create_price`) — placeholder: "不填=输入价"
- 只有 Anthropic 格式的供应商有建立缓存价，OpenAI 格式的只显示缓存命中价

### 13.7 配置更新

初始配置建议：

| 供应商 | 模型 | cache_hit_price | cache_create_price |
|--------|------|----------------|-------------------|
| IKunCode | claude-sonnet-4-6 | 0.28 (¥0.12×2.3) | 3.45 (¥1.50×2.3) |
| IKunCode | claude-opus-4-8 | 0.46 (¥0.20×2.3) | 5.75 (¥2.50×2.3) |
| DeepSeek | deepseek-v4-pro | 0.025 | 无 |
| DeepSeek | deepseek-v4-flash | 0.02 | 无 |
| StepFun | step-3.7-flash | 0.27 | 无 |

---

## 15. 供应商模板（快速添加）

### 15.1 概述

- 提供预配置的供应商模板列表，用户可通过下拉菜单一键填入表单
- 模板从远程 URL 拉取，支持版本更新
- 应用本身**不打包任何模板数据**，模板完全由外部源控制

### 15.2 配置

```yaml
# config/config.yaml 或环境变量 TEMPLATE_URL
template_url: "https://raw.githubusercontent.com/cat5th/llm-proxy-templates/main/templates.json"
```

**优先级：环境变量 > config.yaml > 空（无模板功能）**

### 15.3 数据格式

模板源返回 JSON：

```json
{
  "version": 2,
  "updated_at": "2026-06-01",
  "templates": [
    {
      "id": "openai",
      "name": "OpenAI",
      "base_url": "https://api.openai.com",
      "api_format": "openai_chat",
      "currency": "USD",
      "enabled": true,
      "description": "OpenAI 官方 API",
      "pricing_model": "per_model_token",
      "models": [
        { "name": "gpt-4o", "alias": "", "input_price": 2.5, "output_price": 10, "cache_hit_price": 1.25, "cache_create_price": 2.5 },
        { "name": "gpt-4o-mini", "alias": "", "input_price": 0.15, "output_price": 0.6, "cache_hit_price": 0.075, "cache_create_price": 0.15 }
      ],
      "rate_limits": [],
      "headers": null
    }
  ]
}
```

`id` 必须唯一，作为模板标识。字段与 `Provider` schema 一致，不存在则留空。

### 15.4 后端 API

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/templates` | GET | `?refresh=true` | 返回模板列表 `{ version, updated_at, templates: [...] }`。`refresh=true` 时强制重新拉取远程源 |

- 首次调用或启动时从 `template_url` 拉取
- 内存缓存，每次调用时检查缓存时间（缓存 5 分钟）
- 若 `template_url` 未配置或拉取失败，返回空数组 `{ templates: [] }`
- 后端不做验证（格式由前端校验）

### 15.5 前端行为

- 页面加载时调用 `/api/templates`，结果缓存到 localStorage（key: `template-cache`）
- 缓存携带 `version` 和 `updated_at`，下次启动时优先用缓存，异步刷新
- 手动"刷新模板源"时先清缓存再强制拉取
- 如果模板源为空或拉取失败，下拉菜单只保留"手动创建"入口

## 14. 汇率管理

### 14.1 汇率服务

- 定时调用 `https://open.er-api.com/v6/latest/USD` 获取实时汇率（免费，无需 key）
- 缓存到 SQLite，每小时刷新
- 支持货币列表：USD, CNY, EUR, JPY, GBP, HKD, TWD, KRW, SGD

### 14.2 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/rates` | GET | 返回当前汇率 `{ base: "USD", rates: { CNY: 7.2, ... }, updated_at: "..." }` |
| `/api/rates/preferred` | GET | 返回用户偏好的显示货币 |
| `/api/rates/preferred` | PUT | 设置用户偏好货币 `{ currency: "CNY" }` |

### 14.3 Schema 扩展

- `ProviderSchema` 添加可选字段 `currency: z.string().default("USD")`
- `SubscriptionConfigSchema` 添加可选字段 `currency: z.string().default("USD")`

### 14.4 前端货币显示

- 全局货币选择器放在导航栏右上角
- 切换货币后，所有金额自动换算显示
- 价格输入框的 label 和 placeholder 随货币切换更新
