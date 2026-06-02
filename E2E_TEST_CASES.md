# LLM Proxy Gateway — Phase 2 E2E 测试用例与约定 (修正版)

> 本文档包含 Phase 2 所有核心功能的文字测试用例、data-testid 命名规范、用户交互流程约定。
> 基于需求修正：简化 auths、4 种限流类型、简化统计面板、模型为下拉列表。

---

## 目录

1. [data-testid 命名规范](#1-data-testid-命名规范)
2. [通用交互约定](#2-通用交互约定)
3. [页面 1: 仪表盘 (Dashboard) 测试用例](#3-页面-1-仪表盘-dashboard-测试用例)
4. [页面 2: 模型管理 (Models) 测试用例](#4-页面-2-模型管理-models-测试用例)
5. [页面 3: 供应商管理 (Providers) 测试用例](#5-页面-3-供应商管理-providers-测试用例)
6. [页面 4: 限流状态一览 (Rate Limit Status) 测试用例](#6-页面-4-限流状态一览-rate-limit-status-测试用例)
7. [页面 5: 统计面板 (Stats) 测试用例](#7-页面-5-统计面板-stats-测试用例)
8. [端到端流程测试用例](#8-端到端流程测试用例)
9. [异常与边界场景](#9-异常与边界场景)
10. [E2E 执行顺序建议](#10-e2e-执行顺序建议)
11. [附录 A: data-testid 完整清单](#附录-a-data-testid-完整清单)

---

## 1. data-testid 命名规范

### 1.1 命名格式

```
模块-功能-操作
```

- 全部小写，单词间用连字符 `-` 连接
- 每个测试锚点必须唯一可定位
- 禁止使用随机后缀或时间戳

### 1.2 后缀约定

| 后缀 | 含义 | 示例 |
|------|------|------|
| `-btn` | 按钮（点击操作） | `model-add-btn`, `provider-save-btn` |
| `-input` | 文本输入框 | `model-alias-input`, `provider-url-input` |
| `-select` | 下拉选择器 | `model-provider-select`, `stats-period-select` |
| `-table` | 数据表格 | `model-list-table`, `stats-requests-table` |
| `-card` | 统计/信息卡片 | `dashboard-total-card`, `stats-total-card` |
| `-row` | 表格中的行 | `model-table-row`, `provider-table-row` |
| `-modal` | 模态对话框容器 | `model-add-modal`, `provider-edit-modal` |
| `-dialog` | 确认/提示对话框 | `confirm-delete-dialog` |
| `-toast` | 消息提示 | `success-toast`, `error-toast` |
| `-tab` | 标签页 | `stats-tab-requests`, `stats-tab-tokens` |
| `-badge` | 状态徽标 | `status-normal-badge`, `status-limited-badge` |
| `-chart` | 图表区域 | `requests-chart`, `tokens-chart` |
| `-filter` | 筛选控件 | `stats-period-filter`, `stats-auth-filter` |
| `-empty` | 空状态提示 | `model-empty-state` |
| `-tag` | 标签/标记 | `ratelimit-tag`, `provider-name-tag` |

### 1.3 模块前缀

| 前缀 | 对应模块 |
|------|----------|
| `dashboard-` | 仪表盘 |
| `model-` | 模型别名管理 |
| `provider-` | 供应商管理 |
| `ratelimit-` | 限流状态一览（原授权管理） |
| `stats-` | 统计面板 |
| `nav-` | 导航与布局 |
| `confirm-` | 全局确认对话框 |

### 1.4 完整命名示例

```
# 仪表盘
dashboard-total-requests-card      # 总请求数卡片
dashboard-active-auths-card        # 活跃授权卡片
dashboard-rate-limit-count-card    # 限流次数卡片
dashboard-trend-chart              # 请求趋势图表
dashboard-auth-health-table        # 授权健康状态表格
dashboard-auth-health-row          # 健康状态表格行

# 模型别名
model-add-btn                      # 添加模型别名按钮
model-alias-input                  # 别名输入框
model-provider-select              # 供应商下拉选择
model-model-name-select            # 模型名称下拉选择
model-description-input            # 描述输入框
model-edit-btn                     # 编辑按钮
model-delete-btn                   # 删除按钮
model-list-table                   # 模型列表表格
model-table-row                    # 表格中的行
model-add-modal                    # 添加模态框
model-edit-modal                   # 编辑模态框
model-empty-state                  # 无数据空状态
model-save-btn                     # 保存按钮

# 供应商
provider-add-btn                   # 添加供应商按钮
provider-name-input                # 供应商名称输入 (label="供应商 ID")
provider-url-input                 # 基础 URL 输入 (label="基础 URL")
provider-model-add-btn             # 添加模型按钮
provider-model-name-input          # 模型名称输入 (label="模型名", placeholder="如 gpt-4o")
provider-model-remove-btn          # 删除模型按钮
provider-model-weight-input        # 模型请求倍率输入 (label="请求倍率", placeholder="1")
provider-model-input-price-input   # 模型输入价输入 (label="输入价", placeholder="2.5")
provider-model-output-price-input  # 模型输出价输入 (label="输出价", placeholder="10")
provider-map-alias-select          # 模型别名下拉选择 (label="别名", 默认选项"不填自动创建")
provider-auth-add-btn              # 添加授权按钮
provider-auth-key-input            # API Key 输入 (label="API Key", placeholder="sk-...")
provider-auth-name-input           # 授权名称输入 (label="名称", placeholder="如 主key")
provider-auth-remove-btn           # 删除授权按钮
provider-ratelimit-add-btn         # 添加限流规则按钮
provider-ratelimit-type-select     # 限流类型选择 (label="类型")
provider-ratelimit-period-select   # 时间周期选择 (label="周期")
provider-ratelimit-max-input       # 最大限制值输入 (label="最大值", placeholder="100")
provider-ratelimit-remove-btn      # 删除限流规则按钮
provider-queue-timeout-input       # 队列超时输入
provider-headers-input             # 自定义 Header 输入
provider-edit-btn                  # 编辑按钮
provider-delete-btn                # 删除按钮
provider-save-btn                  # 保存按钮
provider-list-table                # 供应商列表
provider-table-row                 # 表格行
provider-add-modal                 # 添加模态框
provider-edit-modal                # 编辑模态框
provider-ratelimit-tag             # 限流规则标签

# 限流状态一览（原授权管理）
ratelimit-provider-select          # 供应商下拉选择
ratelimit-list-table               # 限流状态列表
ratelimit-table-row                # 表格行
ratelimit-status-badge             # 状态徽标 (正常/接近/超限)
ratelimit-key-text                 # Key 显示文本
ratelimit-requests-count           # 请求次数
ratelimit-limit-type-tag           # 限流类型标签

# 统计面板
stats-period-filter                # 时间范围筛选 (5h/周/月)
stats-type-filter                  # 统计类型筛选 (请求次数/Token用量)
stats-auth-filter                  # 授权筛选 (按 auth key)
stats-tab-requests                 # 请求次数统计标签
stats-tab-tokens                   # Token 用量统计标签
stats-total-card                   # 总请求数卡片
stats-success-card                 # 成功请求卡片
stats-error-card                   # 失败请求卡片
stats-rate-limited-card            # 限流请求卡片
stats-requests-table               # 请求统计表
stats-tokens-table                 # Token 统计表
stats-tokens-chart                 # Token 趋势图表

# 导航
nav-dashboard-tab                  # 仪表盘标签页
nav-models-tab                     # 模型管理标签页
nav-providers-tab                  # 供应商管理标签页
nav-ratelimit-tab                  # 限流状态一览标签页
nav-stats-tab                      # 统计面板标签页

# 确认对话框
confirm-delete-dialog              # 删除确认对话框
confirm-delete-btn                 # 确认删除按钮
confirm-cancel-btn                 # 取消按钮

# 全局
success-toast                      # 成功提示
error-toast                        # 错误提示
loading-spinner                    # 加载动画
```

---

## 2. 通用交互约定

### 2.1 列表操作模式

所有管理页面遵循统一模式：

```
1. 进入页面 → 加载列表（显示 loading-spinner）
2. 列表渲染完成 → 显示 data（或 empty-state）
3. 点击 *-add-btn → 弹出 *-add-modal
4. 填写表单 → 点击 *-save-btn → 关闭弹窗 → 刷新列表 → 显示 success-toast
5. 点击 *-edit-btn → 弹出 *-edit-modal（预填数据）
6. 修改表单 → 点击 *-save-btn → 关闭弹窗 → 刷新列表
7. 点击 *-delete-btn → 弹出 confirm-delete-dialog
8. 确认 → 删除 → 刷新列表 → 显示 success-toast
```

### 2.2 表单验证约定

- 必填字段为空时，*-save-btn 置灰不可点击
- 格式错误时，字段下方显示红色错误文字
- 保存成功后自动关闭弹窗
- 保存失败时弹窗保持打开，显示 error-toast

### 2.3 状态指示约定

| 状态 | 控件 | 预期颜色 |
|------|------|----------|
| 正常 | ratelimit-status-badge | 绿色 (🟢) |
| 接近 | ratelimit-status-badge | 黄色 (🟡) |
| 超限 | ratelimit-status-badge | 红色 (🔴) |

### 2.4 弹窗行为

- 打开时从屏幕中央滑入
- 点击遮罩层或 ESC 键可关闭（未保存时提示确认）
- 表单验证失败时，错误信息在输入框下方显示

---

## 3. 页面 1: 仪表盘 (Dashboard) 测试用例

### TC-001: 查看仪表盘概览 — 三张概览卡片

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-001 |
| 功能模块 | 仪表盘 |
| 前置条件 | 系统已运行，有请求产生 |

**测试步骤：**

1. 导航到仪表盘页面 → 点击 `nav-dashboard-tab`
2. 等待页面加载完成
3. 观察概览卡片区域

**预期结果：**
- `dashboard-total-cost-card` 显示总花费（如 $219.43）
- `dashboard-total-requests-card` 显示总请求数（原始，如 16,752）
- `dashboard-total-rate-limited-card` 显示限流总次数（如 23）

**对应 data-testid：**
`nav-dashboard-tab`, `dashboard-total-cost-card`, `dashboard-total-requests-card`, `dashboard-total-rate-limited-card`

---

### TC-002: 按请求倍率区块 — 表格显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-002 |
| 功能模块 | 仪表盘 |
| 前置条件 | 至少有一个采用"按请求倍率"计费模式的供应商有请求数据 |

**测试步骤：**

1. 导航到仪表盘页面
2. 等待页面加载完成
3. 观察"按请求倍率"区块

**预期结果：**
- `dashboard-section-per-request-weighted` 区块可见
- 区块标题显示"按请求倍率"
- 区块内表格 `dashboard-section-table` 可见
- 表格包含列：供应商、请求倍率量、费用、单价、限流
- 每行 `dashboard-section-table-row` 显示一个供应商的数据
- 合计行 `dashboard-section-table-footer` 显示总计

**对应 data-testid：**
`dashboard-section-per-request-weighted`, `dashboard-section-table`, `dashboard-section-table-row`, `dashboard-section-table-footer`

---

### TC-003: 按 Token 区块 — 表格显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-003 |
| 功能模块 | 仪表盘 |
| 前置条件 | 至少有一个采用"按 Token"计费模式的供应商有请求数据 |

**测试步骤：**

1. 导航到仪表盘页面
2. 等待加载完成
3. 观察"按 Token"区块

**预期结果：**
- `dashboard-section-per-model-token` 区块可见
- 区块标题显示"按 Token"
- 区块内表格显示：供应商、Tokens、费用、均价、限流
- 合计行显示总计

**对应 data-testid：**
`dashboard-section-per-model-token`, `dashboard-section-table`, `dashboard-section-table-row`, `dashboard-section-table-footer`

---

### TC-004: 订阅制区块 — 进度条显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-004 |
| 功能模块 | 仪表盘 |
| 前置条件 | 至少有一个采用"订阅制"计费模式的供应商有数据 |

**测试步骤：**

1. 导航到仪表盘页面
2. 等待加载完成
3. 观察"订阅制"区块

**预期结果：**
- `dashboard-section-subscription` 区块可见
- 区块标题显示"订阅制"
- 每个供应商显示进度条（已用/配额）
- 包含字段：供应商、已用/配额、费用、周期

**对应 data-testid：**
`dashboard-section-subscription`, `dashboard-section-table`, `dashboard-section-table-row`, `dashboard-section-table-footer`

---

### TC-005: 限流状态一览 — 只显示被限流的授权

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-005 |
| 功能模块 | 仪表盘 |
| 前置条件 | 至少有一个授权被限流 |

**测试步骤：**

1. 导航到仪表盘页面
2. 等待加载完成
3. 滚动到页面底部

**预期结果：**
- `dashboard-rate-limited-auths-section` 区块可见
- 区块标题包含"限流状态一览"
- `dashboard-rate-limited-auths-table` 表格可见
- 每行 `dashboard-rate-limited-auths-row` 显示授权的 Auth Key、供应商和触发的限流规则
- 未被限流的授权不显示在此区块

**对应 data-testid：**
`dashboard-rate-limited-auths-section`, `dashboard-rate-limited-auths-table`, `dashboard-rate-limited-auths-row`

---

### TC-006: 仪表盘空状态

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-006 |
| 功能模块 | 仪表盘 |
| 前置条件 | 系统无任何数据 |

**测试步骤：**

1. 导航到仪表盘页面
2. 等待加载完成

**预期结果：**
- 概览卡片全部显示 0
- 三个计费模式区块各自显示空状态
- 限流状态一览区块显示"暂无被限流的授权"

**对应 data-testid：**
`dashboard-total-cost-card`, `dashboard-total-requests-card`, `dashboard-total-rate-limited-card`,
`dashboard-section-per-request-weighted`, `dashboard-section-per-model-token`, `dashboard-section-subscription`,
`dashboard-rate-limited-auths-section`

---

### TC-007: 可展开行 — 点击展开显示授权限流进度条

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-007 |
| 功能模块 | 仪表盘 |
| 前置条件 | 至少有一个供应商有请求数据且有授权 |

**测试步骤：**

1. 导航到仪表盘页面
2. 在任一计费模式区块中，找到供应商行 `dashboard-expandable-row`
3. 点击该行

**预期结果：**
- 行末展开箭头由 ▶ 变为 ▼
- 行下方展开 `dashboard-expanded-row` 容器
- 展开容器内显示该供应商下的所有授权
- 每个授权显示 `dashboard-expanded-auth-row`，包含：
  - 授权名称
  - Auth Key（简写）
  - 该授权所有限流规则的进度条

**对应 data-testid：**
`dashboard-expandable-row`, `dashboard-expanded-row`, `dashboard-expanded-auth-row`, `dashboard-auth-limit-bar`, `dashboard-auth-limit-label`

---

### TC-008: 可展开行 — 再次点击折叠

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-008 |
| 功能模块 | 仪表盘 |
| 前置条件 | 已展开某供应商行 |

**测试步骤：**

1. 在已展开的供应商行上再次点击
2. 观察展示

**预期结果：**
- 展开容器消失
- 行末箭头恢复为 ▶
- 页面上不再显示该行的授权进度条信息

---

### TC-009: 可展开行 — 每条限流规则显示进度条

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-009 |
| 功能模块 | 仪表盘 |
| 前置条件 | 供应商有 rate_limits 配置且已展开 |

**测试步骤：**

1. 展开一个有限流规则的供应商行
2. 观察每条限流规则

**预期结果：**
- 每条规则显示 `dashboard-auth-limit-label`（如 "weighted_requests/minute"）
- 对应显示进度条 `dashboard-auth-limit-bar`
- 进度条显示百分比使用率
- 显示数值：used / max
- 使用率 < 80% 时进度条为绿色
- 使用率 >= 80% 且 < 100% 时进度条为黄色
- 使用率 >= 100% 时进度条为红色

---

## 4. 页面 2: 模型管理 (Models) 测试用例

### TC-006: 添加模型别名（基本流程）

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-006 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 已创建至少一个供应商（如 `provider_a`），该供应商有至少一个模型 |

**测试步骤：**

1. 导航到模型管理页面 → 点击 `nav-models-tab`
2. 等待列表加载完成，确认 `model-list-table` 可见
3. 点击 `model-add-btn`，确认 `model-add-modal` 弹出
4. 在 `model-alias-input` 中输入 `my-smart-model`
5. 在 `model-provider-select` 中选择 `provider_a`
6. 在 `model-model-name-select` 中选择 `gpt-4`（从供应商的模型列表下拉选择）
7. 在 `model-description-input` 中输入可选描述（如 "My smart model"）
8. 点击 `model-save-btn`

**预期结果：**
- 弹窗自动关闭
- 列表刷新，新增一行 `model-table-row` 显示别名 `my-smart-model`
- 该行显示供应商 `provider_a` 和模型名 `gpt-4`
- 顶部出现 `success-toast` 提示 "模型别名创建成功"

**对应 data-testid：**
`nav-models-tab`, `model-list-table`, `model-add-btn`, `model-add-modal`,
`model-alias-input`, `model-provider-select`, `model-model-name-select`,
`model-description-input`, `model-save-btn`, `model-table-row`, `success-toast`

---

### TC-007: 添加模型别名 — 别名格式校验

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-007 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 同上 |

**测试步骤：**

1. 点击 `model-add-btn`
2. 在 `model-alias-input` 中输入 `invalid model name!`（含空格和特殊字符）
3. 观察输入框下方错误提示

**预期结果：**
- 输入框下方显示红色错误文字：「别名只能包含字母、数字、连字符和下划线」
- `model-save-btn` 处于置灰不可点击状态

**对应 data-testid：**
`model-add-btn`, `model-alias-input`, `model-save-btn`

---

### TC-008: 添加模型别名 — 重复别名校验

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-008 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 已存在别名 `my-smart-model` |

**测试步骤：**

1. 点击 `model-add-btn`
2. 在 `model-alias-input` 中输入已存在的别名 `my-smart-model`
3. 点击 `model-save-btn`

**预期结果：**
- 弹窗保持打开
- 顶部出现 `error-toast` 提示 "别名已存在"
- 列表无变化

**对应 data-testid：**
`model-add-btn`, `model-alias-input`, `model-save-btn`, `error-toast`

---

### TC-009: 编辑模型别名

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-009 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 已存在别名 `my-smart-model` |

**测试步骤：**

1. 在 `model-list-table` 中找到 `my-smart-model` 对应的 `model-table-row`
2. 点击该行的 `model-edit-btn`，确认 `model-edit-modal` 弹出
3. 确认 `model-alias-input` 已预填 `my-smart-model`
4. 切换 `model-provider-select` 为另一个供应商
5. `model-model-name-select` 自动更新为该供应商的模型列表，选择新模型
6. 点击 `model-save-btn`

**预期结果：**
- 弹窗自动关闭
- 列表中该行显示更新后的供应商和模型
- 顶部出现 `success-toast`

**对应 data-testid：**
`model-list-table`, `model-table-row`, `model-edit-btn`, `model-edit-modal`,
`model-alias-input`, `model-provider-select`, `model-model-name-select`,
`model-save-btn`, `success-toast`

---

### TC-010: 删除模型别名

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-010 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 已存在别名 `my-smart-model` |

**测试步骤：**

1. 在 `model-list-table` 中找到 `my-smart-model` 对应的 `model-table-row`
2. 点击该行的 `model-delete-btn`
3. 确认 `confirm-delete-dialog` 弹出
4. 点击 `confirm-delete-btn`

**预期结果：**
- 对话框关闭
- 列表刷新，`my-smart-model` 所在行消失
- 顶部出现 `success-toast` 提示 "模型别名删除成功"

**对应 data-testid：**
`model-list-table`, `model-table-row`, `model-delete-btn`,
`confirm-delete-dialog`, `confirm-delete-btn`, `success-toast`

---

### TC-011b: 创建模型别名时配置会话亲和性

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-011b |
| 功能模块 | 模型别名管理 |
| 前置条件 | 至少存在一个供应商 |

**测试步骤：**

1. 点击 `model-add-btn` → 弹出创建弹窗
2. 在 `model-alias-input` 中输入 `test-session-model`
3. 选择供应商和模型
4. 确认 `model-session-affinity-checkbox` 默认已勾选（默认开启）
5. 取消勾选 `model-session-affinity-checkbox`
6. 点击 `model-save-btn`

**预期结果：**
- 弹窗关闭，success-toast 显示
- 列表中出现 `test-session-model`

**对应 data-testid：**
`model-add-btn`, `model-alias-input`, `model-save-btn`,
`model-session-affinity-checkbox`, `success-toast`

---

### TC-011: 模型列表为空时显示空状态

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-011 |
| 功能模块 | 模型别名管理 |
| 前置条件 | 无任何模型别名 |

**测试步骤：**

1. 导航到模型管理页面 → 点击 `nav-models-tab`
2. 等待加载完成

**预期结果：**
- 不显示 `model-list-table`
- 显示 `model-empty-state`，包含提示文字和 `model-add-btn`
- 点击 `model-add-btn` 可正常弹出添加弹窗

**对应 data-testid：**
`nav-models-tab`, `model-empty-state`, `model-add-btn`

---

### TC-011b: 供应商切换时模型下拉联动

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-011b |
| 功能模块 | 模型别名管理 |
| 前置条件 | 存在多个供应商（各有不同模型） |

**测试步骤：**

1. 点击 `model-add-btn`
2. 先在 `model-provider-select` 中选择 `provider_a`
3. 观察 `model-model-name-select` 中的选项
4. 切换 `model-provider-select` 为 `provider_b`
5. 再次观察 `model-model-name-select`

**预期结果：**
- 选择 `provider_a` 时，模型下拉仅显示 `provider_a` 的模型
- 切换为 `provider_b` 后，模型下拉自动更新为 `provider_b` 的模型
- 已选择的模型值被重置

**对应 data-testid：**
`model-provider-select`, `model-model-name-select`

### TC-011c: 模型别名自定义 Headers

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-011c |
| 功能模块 | 模型管理 |
| 前置条件 | 已打开模型别名编辑弹窗 |

测试步骤：

1. 找到 `model-headers-input` 文本输入框
2. 输入 `{"anthropic-dangerous-direct-browser-access": "true"}`
3. 保存模型别名
4. 重新打开编辑弹窗
5. 确认 `model-headers-input` 内容与输入一致
6. 清空并保存
7. 确认 headers 可正常留空

| 断言 | 说明 |
|------|------|
| - headers 输入框存在 | 第 1 步 |
| - 保存后回显正确 | 第 5 步 |
| - 清空不留残留 | 第 7 步 |

---

## 5. 页面 3: 供应商管理 (Providers) 测试用例

### TC-012: 添加供应商（基本流程）

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-012 |
| 功能模块 | 供应商管理 |
| 前置条件 | 无 |

**测试步骤：**

1. 导航到供应商管理页面 → 点击 `nav-providers-tab`
2. 点击 `provider-add-btn`，确认 `provider-add-modal` 弹出
3. 在 `provider-name-input` 中输入 `provider_a`
4. 在 `provider-url-input` 中输入 `https://api.openai.com`
5. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 列表新增一行，显示名称 `provider_a`、基础 URL `https://api.openai.com`
- `success-toast` 提示 "供应商创建成功"

**对应 data-testid：**
`nav-providers-tab`, `provider-add-btn`, `provider-add-modal`,
`provider-name-input`, `provider-url-input`, `provider-save-btn`,
`success-toast`

---

### TC-013: 添加供应商 — 模型配置

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-013 |
| 功能模块 | 供应商管理 |
| 前置条件 | 无 |

**测试步骤：**

1. 点击 `provider-add-btn`
2. 填写供应商名称和 URL
3. 在模型区域点击 `provider-model-add-btn`
4. 在 `provider-model-name-input` 中输入 `gpt-4`（label="模型名", placeholder="如 gpt-4o"）
5. 在 `provider-model-weight-input` 中输入 `2`（label="请求倍率", placeholder="1"）
6. 在 `provider-model-input-price-input` 中输入 `10`（label="输入价", placeholder="2.5"）
7. 在 `provider-model-output-price-input` 中输入 `30`（label="输出价", placeholder="10"）
8. 在 `provider-map-alias-select` 中选择 `"不填，自动创建"`（默认选项，value=""）
9. 再次点击 `provider-model-add-btn`
10. 在第二个 `provider-model-name-input` 中输入 `gpt-3.5-turbo`
11. 在第二个 `provider-map-alias-select` 中选择一个已有别名（如 `chat-model`）
12. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 供应商行中显示支持的模型列表（`gpt-4`, `gpt-3.5-turbo`）
- 模型信息中显示请求倍率和价格配置
- 第一个模型因别名未填，自动创建/关联同名别名
- 第二个模型关联已选择的别名
- `success-toast` 提示 "供应商创建成功"

**对应 data-testid：**
`provider-add-btn`, `provider-name-input`, `provider-url-input`,
`provider-model-add-btn`, `provider-model-name-input`,
`provider-model-weight-input`, `provider-model-input-price-input`,
`provider-model-output-price-input`, `provider-map-alias-select`,
`provider-save-btn`, `success-toast`

---

### TC-014: 添加供应商 — 限流规则配置（3 种类型）

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-014 |
| 功能模块 | 供应商管理 / 限流规则 |
| 前置条件 | 无 |

**测试步骤：**

1. 点击 `provider-add-btn`
2. 填写供应商基本信息
3. 在限流规则区域点击 `provider-ratelimit-add-btn`
4. 在 `provider-ratelimit-type-select` 中选择 `weighted_requests`（请求加权数）（label="类型"）
5. 在 `provider-ratelimit-period-select` 中选择 `5 小时`（label="周期"）
6. 在 `provider-ratelimit-max-input` 中输入 `100`（label="最大值", placeholder="100"）
7. 再次点击 `provider-ratelimit-add-btn` 添加第二条规则
8. 在 `provider-ratelimit-type-select` 中选择 `tokens`（Token 数）
9. 在 `provider-ratelimit-period-select` 中选择 `month`
10. 在 `provider-ratelimit-max-input` 中输入 `1000000`
11. 再次点击 `provider-ratelimit-add-btn` 添加第三条规则
12. 在 `provider-ratelimit-type-select` 中选择 `concurrency`（并发）
13. 在 `provider-ratelimit-max-input` 中输入 `5`
14. 在 `provider-queue-timeout-input` 中输入 `30`（秒）
15. 在 `provider-headers-input` 中输入 `{"X-Custom-Header": "value"}`
16. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 供应商行中显示限流规则摘要（3 条规则，显示类型标签：weighted_requests/tokens/concurrency）
- 队列超时显示为 30s
- `success-toast` 提示 "供应商创建成功"

**对应 data-testid：**
`provider-add-btn`, `provider-name-input`, `provider-url-input`,
`provider-ratelimit-add-btn`, `provider-ratelimit-type-select`,
`provider-ratelimit-period-select`, `provider-ratelimit-max-input`,
`provider-queue-timeout-input`, `provider-headers-input`,
`provider-save-btn`, `success-toast`

---

### TC-015: 限流规则类型切换 — 周期字段显隐

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-015 |
| 功能模块 | 供应商管理 / 限流规则 |
| 前置条件 | 在供应商添加/编辑弹窗中 |

**测试步骤：**

1. 点击 `provider-ratelimit-add-btn`
2. 在 `provider-ratelimit-type-select` 中选择 `weighted_requests`
3. 观察周期选择器可见
4. 切换 `provider-ratelimit-type-select` 为 `concurrency`
5. 观察周期选择器隐藏
6. 切换 `provider-ratelimit-type-select` 为 `tokens`
7. 观察周期选择器重新显示

**预期结果：**
- 选择 `requests`/`tokens` 时，`provider-ratelimit-period-select` 可见
- 选择 `concurrency` 时，`provider-ratelimit-period-select` 隐藏或禁用
- 切换类型时，已填写的最大值不丢失

**对应 data-testid：**
`provider-ratelimit-add-btn`, `provider-ratelimit-type-select`,
`provider-ratelimit-period-select`, `provider-ratelimit-max-input`

---

### TC-016: 编辑供应商

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-016 |
| 功能模块 | 供应商管理 |
| 前置条件 | 已创建供应商 `provider_a` |

**测试步骤：**

1. 在 `provider-list-table` 中找到 `provider_a`
2. 点击 `provider-edit-btn`，确认 `provider-edit-modal` 弹出
3. 确认 `provider-name-input` 已预填 `provider_a`
4. 确认 `provider-url-input` 已预填 `https://api.openai.com`
5. 将 URL 修改为 `https://api.openai.com/v1`
6. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 列表中该行 URL 更新为 `https://api.openai.com/v1`
- `success-toast` 提示 "供应商更新成功"

**对应 data-testid：**
`provider-list-table`, `provider-edit-btn`, `provider-edit-modal`,
`provider-name-input`, `provider-url-input`, `provider-save-btn`,
`success-toast`

---

### TC-017: 删除供应商

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-017 |
| 功能模块 | 供应商管理 |
| 前置条件 | 已创建供应商 `provider_a`，未被任何模型引用 |

**测试步骤：**

1. 在 `provider-list-table` 中找到 `provider_a`
2. 点击 `provider-delete-btn`
3. 确认 `confirm-delete-dialog` 弹出
4. 点击 `confirm-delete-btn`

**预期结果：**
- 对话框关闭
- 列表中 `provider_a` 行消失
- `success-toast` 提示 "供应商删除成功"

**对应 data-testid：**
`provider-list-table`, `provider-delete-btn`, `confirm-delete-dialog`,
`confirm-delete-btn`, `success-toast`

---

### TC-018: 删除被引用的供应商 — 阻止删除

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-018 |
| 功能模块 | 供应商管理 |
| 前置条件 | `provider_a` 已被模型别名 `my-smart-model` 引用 |

**测试步骤：**

1. 在 `provider-list-table` 中找到 `provider_a`
2. 点击 `provider-delete-btn`
3. 点击 `confirm-delete-btn`

**预期结果：**
- 对话框关闭
- `error-toast` 提示 "该供应商正在被模型引用，无法删除"
- 列表中 `provider_a` 行仍然存在

**对应 data-testid：**
`provider-list-table`, `provider-delete-btn`, `confirm-delete-btn`,
`error-toast`

---

### TC-M-01: 通过模板快速添加供应商

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-M-01 |
| 功能模块 | 供应商管理 / 模板 |
| 前置条件 | 后端已配置 `template_url` 且返回有效模板数据 |

**测试步骤：**

1. 点击 `provider-template-btn`（顶部 "快速添加 ▾" 按钮）
2. 下拉菜单展开，可见模板列表项
3. 点击模板项（如 "OpenAI"）
4. 弹出新建模态框 `provider-add-modal`
5. 检查表单字段已按模板预填：名称、基础 URL、API 格式、计费方式、模型行价格等

**预期结果：**
- 下拉菜单包含模板源返回的所有模板名称
- 底部有 "手动创建" 和 "刷新模板源" 两个选项
- 点击模板后模态框表单字段自动填入
- 各字段值正确匹配模板数据

**对应 data-testid：**
`provider-template-btn`, `provider-add-modal`, `provider-name-input`,
`provider-url-input`, `provider-api-format-select`, `provider-pricing-model-select`

---

### TC-M-02: 模板失效时的降级行为

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-M-02 |
| 功能模块 | 供应商管理 / 模板 |
| 前置条件 | `template_url` 未配置或返回空数据 |

**测试步骤：**

1. 点击 `provider-template-btn`
2. 观察下拉菜单

**预期结果：**
- 下拉菜单只有 "手动创建" 和 "刷新模板源" 两个选项
- 没有模板列表项
- 点击 "手动创建" 弹出空白供应商表单

**对应 data-testid：**
`provider-template-btn`, `provider-add-modal`

---

### TC-M-03: 刷新模板源

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-M-03 |
| 功能模块 | 供应商管理 / 模板 |
| 前置条件 | 已缓存过模板数据 |

**测试步骤：**

1. 点击 `provider-template-btn`
2. 点击下拉菜单中的 "刷新模板源"
3. 等待请求完成

**预期结果：**
- 前端清空 localStorage 中缓存的模板数据
- 向后端请求 `/api/templates?refresh=true`
- 请求成功 → `success-toast` 提示 "模板已刷新"
- 请求失败 → `error-toast` 提示 "模板刷新失败"
- 下拉菜单更新为最新的模板列表

**对应 data-testid：**
`provider-template-btn`, `success-toast`, `error-toast`

---

### TC-M-04: 模板应用后字段可手动修改

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-M-04 |
| 功能模块 | 供应商管理 / 模板 |
| 前置条件 | 已通过模板填充表单 |

**测试步骤：**

1. 点击模板项（如 "OpenAI"）填充表单
2. 修改输入价、基础 URL、模型名等任意字段
3. 点击保存

**预期结果：**
- 供应商按照修改后的字段保存
- 模板仅提供默认值，用户可在保存前任意修改

**对应 data-testid：**
`provider-name-input`, `provider-url-input`, `provider-model-input-price-input`,
`provider-save-btn`, `success-toast`

---

### TC-019: 授权管理 — 新增授权

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-019 |
| 功能模块 | 授权管理 |
| 前置条件 | 已创建至少一个供应商 |

**测试步骤：**

1. 进入授权管理页面
2. 点击 `auth-add-btn`
3. 在 `auth-provider-select` 中选择一个供应商
4. 在 `auth-key-input` 中输入 `***`
5. 在 `auth-name-input` 中输入 `测试Key`
6. 点击 `auth-save-btn`
7. 确认列表中显示新添加的授权（key 前 12 位 + `...`）

**预期结果：**
- 授权保存成功，存入 SQLite `provider_auths` 表
- 列表中出现新行
- 删除后重新打开，该授权不再显示

**对应 data-testid：**
`auth-add-btn`, `auth-provider-select`, `auth-key-input`,
`auth-name-input`, `auth-save-btn`, `auth-delete-btn`

---

### TC-020: 删除限流规则

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020 |
| 功能模块 | 供应商管理 / 限流规则 |
| 前置条件 | 供应商已有至少一条限流规则 |

**测试步骤：**

1. 在 `provider-list-table` 中找到目标供应商
2. 点击 `provider-edit-btn`
3. 在限流规则区域找到要删除的规则行
4. 点击该规则的 `provider-ratelimit-remove-btn`
5. 确认该规则从列表中消失
6. 点击 `provider-save-btn`

**预期结果：**
- 保存成功
- 供应商行中对应限流规则标签消失
- `success-toast` 提示 "供应商更新成功"

**对应 data-testid：**
`provider-edit-btn`, `provider-ratelimit-remove-btn`,
`provider-save-btn`, `success-toast`

---

### TC-020b: 添加供应商 — 完整的全功能表单

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020b |
| 功能模块 | 供应商管理 |
| 前置条件 | 无 |

**测试步骤：**

1. 点击 `provider-add-btn`
2. 填写：名称=`full-provider`, URL=`https://api.test.com`
3. 添加 2 个模型：`model-x`（别名留空，自动创建）、`model-y`（从 `provider-map-alias-select` 下拉中选择已有别名）
4. 添加 2 个授权 Key：`sk-key-111`, `sk-key-222`
5. 添加全部 3 种限流规则：requests(100/5h), tokens(1M/month), concurrency(5)
6. 设置计费模型：`按请求倍率计费`，单价 0.002
7. 设置队列超时 = 30s
8. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 列表新增 `full-provider`，显示 2 个模型、2 个授权、3 条限流规则、计费模型信息
- `success-toast` 提示 "供应商创建成功"

**对应 data-testid：**
`provider-add-btn`, `provider-name-input`, `provider-url-input`,
`provider-model-add-btn`, `provider-model-name-input`,
`provider-model-weight-input`, `provider-model-input-price-input`,
`provider-model-output-price-input`, `provider-map-alias-select`,
`provider-auth-add-btn`, `provider-auth-key-input`,
`provider-ratelimit-add-btn`, `provider-ratelimit-type-select`,
`provider-ratelimit-period-select`, `provider-ratelimit-max-input`,
`provider-pricing-model-select`, `provider-unit-price-input`,
`provider-queue-timeout-input`, `provider-save-btn`, `success-toast`

---

### TC-020c: 添加供应商 — 计费模型配置（订阅制 weighted_requests）

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020c |
| 功能模块 | 供应商管理 / 计费模型 |
| 前置条件 | 无 |

**测试步骤：**

1. 点击 `provider-add-btn`
2. 填写：名称=`sub-provider`, URL=`https://api.subscription.com`
3. 添加 1 个模型 `model-a`
4. 在计费模型区域，从 `provider-pricing-model-select` 中选择 `subscription`（订阅制）
5. 在 `provider-unit-price-input` 中输入 `0.002`
6. 在 `provider-subscription-price-input` 中输入 `499`
7. 确认 `provider-subscription-period-select` 默认值为 `每月`
8. 从 `provider-subscription-billing-type-select` 中选择 `请求倍率量数`（默认）
9. 在 `provider-subscription-included-input` 中输入 `10000`
10. 在 `provider-subscription-overage-price-input` 中输入 `0.002`
11. 点击 `provider-save-btn`

**预期结果：**
- 弹窗关闭
- 列表新增 `sub-provider`，供应商保存成功
- `success-toast` 提示 "供应商创建成功"

**对应 data-testid：**
`provider-add-btn`, `provider-name-input`, `provider-url-input`,
`provider-pricing-model-select`, `provider-unit-price-input`,
`provider-subscription-price-input`, `provider-subscription-period-select`,
`provider-subscription-billing-type-select`,
`provider-subscription-included-input`, `provider-subscription-overage-price-input`,
`provider-save-btn`, `success-toast`

---

### TC-020d: 供应商计费模型 — 选择不同模型显示对应字段

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020d |
| 功能模块 | 供应商管理 / 计费模型 |
| 前置条件 | 在供应商添加弹窗中 |

**测试步骤：**

1. 点击 `provider-add-btn`
2. 在 `provider-pricing-model-select` 中选择 `per_request_weighted`（按请求倍率计费）
3. 确认 `provider-unit-price-input` 可见
4. 确认订阅相关字段（price/period/billing_type/included/overage）隐藏
5. 切换 `provider-pricing-model-select` 为 `per_model_token`（按模型 Token 计费）
6. 确认 `provider-unit-price-input` 隐藏
7. 确认订阅相关字段隐藏
8. 切换 `provider-pricing-model-select` 为 `subscription`（订阅制）
9. 确认 `provider-unit-price-input` 可见
10. 确认 `provider-subscription-price-input`、`provider-subscription-period-select`、`provider-subscription-billing-type-select` 均可见
11. 确认根据 `provider-subscription-billing-type-select` 的当前值，显示对应的字段组

**预期结果：**
- `per_request_weighted` 仅显示单价输入
- `per_model_token` 不显示额外字段
- `subscription` 显示单价和全部订阅字段（含计费方式下拉）

**对应 data-testid：**
`provider-add-btn`, `provider-pricing-model-select`, `provider-unit-price-input`,
`provider-subscription-price-input`, `provider-subscription-period-select`,
`provider-subscription-billing-type-select`,
`provider-subscription-included-input`, `provider-subscription-overage-price-input`

---

### TC-020e: 订阅制 billing_type 切换 — 字段联动

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020e |
| 功能模块 | 供应商管理 |
| 前置条件 | 已打开供应商编辑弹窗，计费方式选择 `订阅制` |

测试步骤：

1. 从 `provider-subscription-billing-type-select` 中选择 `加权请求数`
2. 确认 `provider-subscription-included-input`（包含请求数）显示
3. 确认 `provider-subscription-overage-price-input`（超额单价）显示
4. 确认 `provider-subscription-included-tokens-input`（包含 Token 数）隐藏
5. 选择 `Token 量`
6. 确认 `provider-subscription-included-tokens-input` 显示
7. 确认 `provider-subscription-included-input` 隐藏
8. 确认 `provider-subscription-overage-price-input` 隐藏
9. 切换 `provider-subscription-billing-type-select` 回 `加权请求数`

| 断言 | 说明 |
|------|------|
| - 选择 `加权请求数` 时显示：包含请求数、超额单价 | 第 2-3 步 |
| - 选择 `Token 量` 时显示：包含 Token 数（隐藏超额单价） | 第 5-8 步 |

### TC-020f: 供应商模型缓存价配置

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020f |
| 功能模块 | 供应商管理 |
| 前置条件 | 已打开供应商编辑弹窗，计费方式为 `per_model_token` |

测试步骤：

1. 确认模型行中显示 `provider-model-cache-hit-price-input` 和 `provider-model-cache-create-price-input`
2. 在缓存命中价输入 `0.5`
3. 在建立缓存价输入 `1.0`
4. 保存供应商
5. 重新打开编辑弹窗
6. 确认缓存命中价回显 `0.5`
7. 确认建立缓存价回显 `1.0`
8. 清空两个缓存价输入框
9. 保存并重新打开
10. 确认两个缓存价输入框为空 (不填=输入价)

| 断言 | 说明 |
|------|------|
| - 缓存命中价输入框存在且值为 `0.5` | 第 2 步 |
| - 建立缓存价输入框存在且值为 `1.0` | 第 3 步 |
| - 重新编辑后缓存命中价回显 `0.5` | 第 6 步 |
| - 重新编辑后建立缓存价回显 `1.0` | 第 7 步 |
| - 清空后两个输入框为空 | 第 10 步 |

### TC-020g: 缓存价字段显示条件

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020g |
| 功能模块 | 供应商管理 |
| 前置条件 | 打开供应商编辑弹窗 |

测试步骤：

1. 确认当前计费方式为 `per_request_weighted` 时，模型行中**不显示**缓存价输入框
2. 切换计费方式为 `per_model_token`
3. 清空模型行的输入价，确认缓存价输入框消失
4. 填入输入价 `10`，确认缓存命中价输入框出现
5. 切换供应商 `api_format` 为 `openai_chat`
6. 确认建立缓存价输入框**不显示**
7. 切换 `api_format` 为 `anthropic_messages`
8. 确认建立缓存价输入框**显示**

| 断言 | 说明 |
|------|------|
| - per_request_weighted 时无缓存价输入框 | 第 1 步 |
| - 输入价为空时缓存价输入框不显示 | 第 3 步 |
| - 输入价有值时缓存命中价出现 | 第 4 步 |
| - openai_chat 格式无建立缓存价 | 第 6 步 |
| - anthropic_messages 格式显示建立缓存价 | 第 8 步 |

### TC-020h: 自定义 Headers 配置

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020h |
| 功能模块 | 供应商管理 |
| 前置条件 | 打开供应商编辑弹窗 |

测试步骤：

1. 找到 `provider-headers-input` 文本输入框
2. 输入 `{"User-Agent": "MyAgent/1.0"}`
3. 保存供应商
4. 重新打开编辑弹窗
5. 确认 `provider-headers-input` 内容为 `{"User-Agent": "MyAgent/1.0"}`
6. 清空 headers 输入框
7. 保存并重新打开
8. 确认 headers 输入框为空

| 断言 | 说明 |
|------|------|
| - headers 输入框存在 | 第 1 步 |
| - 保存后回显正确 | 第 5 步 |
| - 清空后为空 | 第 8 步 |

### TC-020i: 计费方式联动模型字段

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020i |
| 功能模块 | 供应商管理 |
| 前置条件 | 打开供应商编辑弹窗 |

测试步骤：

1. 设置计费方式为 `per_request_weighted`
2. 确认模型行显示：模型名 ✅、请求倍率 ✅、别名 ✅；输入价/输出价/缓存价 ❌
3. 切换计费方式为 `per_model_token`
4. 确认模型行显示：模型名 ✅、输入价 ✅、输出价 ✅、别名 ✅；请求倍率 ❌
5. 填入输入价 `10`，确认缓存命中价 ✅ 和建立缓存价 ✅ 出现
6. 切换计费方式为 `subscription`，`billing_type` 选 `weighted_requests`
7. 确认模型行显示：模型名 ✅、请求倍率 ✅、别名 ✅；输入/输出/缓存价 ❌
8. 切换 `billing_type` 为 `tokens`
9. 确认模型行显示：模型名 ✅、输入价 ✅、输出价 ✅、别名 ✅；请求倍率 ❌
10. 填入输入价 `10`，确认缓存命中价 ✅ 出现
11. 切换 `billing_type` 为 `unlimited`
12. 确认模型行只显示：模型名 ✅、别名 ✅；其他所有字段 ❌

| 断言 | 说明 |
|------|------|
| - per_request_weighted 显示请求倍率 | 第 2 步 |
| - per_model_token 显示输入/输出价 | 第 4 步 |
| - per_model_token+输入价 显示缓存价 | 第 5 步 |
| - subscription+weighted 显示请求倍率 | 第 7 步 |
| - subscription+tokens 显示输入/输出价 | 第 9 步 |
| - subscription+unlimited 只有模型名+别名 | 第 12 步 |

### TC-020j: 供应商 API 格式选择与自动识别

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-020j |
| 功能模块 | 供应商管理 |
| 前置条件 | 打开供应商编辑弹窗 |

测试步骤：

1. 确认 `provider-api-format-select` 存在，默认值为 `OpenAI Chat`
2. 在基础 URL 输入 `https://api.anthropic.com`
3. 确认 `provider-api-format-select` 自动切换为 `Anthropic (/messages)`
4. 手动切换回 `OpenAI Chat`
5. 确认下拉未被锁定，可自由切换
6. 在基础 URL 输入 `https://api.deepseek.com`
7. 确认 `provider-api-format-select` 自动切换为 `OpenAI Chat`

| 断言 | 说明 |
|------|------|
| - API 格式选择器存在 | 第 1 步 |
| - URL 含 anthropic 时自动识别 | 第 3 步 |
| - 可手动覆盖自动识别结果 | 第 4-5 步 |
| - URL 含 deepseek 时自动识别 | 第 7 步 |
- 选择 `Token 量` 时显示：包含 Token 数
- 切换后字段联动正确

**对应 data-testid：**
`provider-subscription-billing-type-select`,
`provider-subscription-included-input`,
`provider-subscription-overage-price-input`,
`provider-subscription-included-tokens-input`,
`provider-save-btn`

---

## 6. 页面 4: 限流状态一览 (Rate Limit Status) 测试用例

> 原"授权管理"页面已改为只读的"限流状态一览"页面。
> 授权 Key 已集成到供应商表单内，此页面仅用于查看各授权 Key 的限流状态。

### TC-021: 查看限流状态一览

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-021 |
| 功能模块 | 限流状态一览 |
| 前置条件 | 已创建供应商并添加授权 Key |

**测试步骤：**

1. 导航到限流状态一览页面 → 点击 `nav-ratelimit-tab`
2. 等待列表加载完成
3. 观察限流状态表格

**预期结果：**
- `ratelimit-list-table` 可见
- 表格包含列：Key（部分掩码）、名称（如有）、供应商、状态、请求数、限流类型
- 每行显示一个授权 Key 的当前状态
- 状态使用颜色标识：🟢 正常、🟡 接近、🔴 超限

**对应 data-testid：**
`nav-ratelimit-tab`, `ratelimit-list-table`, `ratelimit-table-row`,
`ratelimit-status-badge`, `ratelimit-key-text`

---

### TC-022: 按供应商筛选

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-022 |
| 功能模块 | 限流状态一览 |
| 前置条件 | 为多个供应商创建了授权 |

**测试步骤：**

1. 导航到限流状态一览页面
2. 在 `ratelimit-provider-select` 中选择 `provider_a`
3. 观察列表
4. 切换为 `provider_b`
5. 观察列表

**预期结果：**
- 选择 `provider_a` 时，仅显示 `provider_a` 下的授权
- 选择 `provider_b` 时，仅显示 `provider_b` 下的授权
- 每次切换后列表立即刷新

**对应 data-testid：**
`ratelimit-provider-select`, `ratelimit-list-table`, `ratelimit-table-row`

---

### TC-023: 查看被限流的授权详情

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-023 |
| 功能模块 | 限流状态一览 |
| 前置条件 | 已有授权触发了限流 |

**测试步骤：**

1. 导航到限流状态一览页面
2. 在 `ratelimit-list-table` 中找到被限流的行
3. 观察状态徽标和限流信息

**预期结果：**
- 被限流的行显示 🔴 超限状态
- 行中显示被哪种限流规则限制（如 `requests/5h`）
- `ratelimit-limit-type-tag` 显示限流类型标签
- 该行不可编辑（只读）

**对应 data-testid：**
`ratelimit-list-table`, `ratelimit-table-row`, `ratelimit-status-badge`,
`ratelimit-limit-type-tag`

---

### TC-024: 限流状态一览无数据时显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-024 |
| 功能模块 | 限流状态一览 |
| 前置条件 | 无任何授权 Key |

**测试步骤：**

1. 导航到限流状态一览页面

**预期结果：**
- `ratelist-empty-state` 可见
- 提示文字："暂无授权 Key，请在供应商表单中添加"

**对应 data-testid：**
`nav-ratelimit-tab`, `ratelist-empty-state`

---

### TC-025: 限流状态一览 — 显示限流类型明细

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-025 |
| 功能模块 | 限流状态一览 |
| 前置条件 | 供应商配置了多类型限流规则，且有请求 |

**测试步骤：**

1. 导航到限流状态一览页面
2. 选择一个配置了多种限流类型的供应商
3. 观察每个授权行的限流类型标签

**预期结果：**
- 每行显示该授权命中/适用的限流类型（requests, tokens, concurrency）
- 每个限流类型使用 `ratelimit-limit-type-tag` 标签展示
- 超限的限流类型标签高亮显示

**对应 data-testid：**
`ratelimit-limit-type-tag`

---

## 7. 页面 5: 统计面板 (Stats) 测试用例

### TC-026: 查看统计面板 — 请求次数统计

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-026 |
| 功能模块 | 统计面板 |
| 前置条件 | 已有请求产生 |

**测试步骤：**

1. 导航到统计面板 → 点击 `nav-stats-tab`
2. 等待页面加载完成
3. 在统计类型中切换为 `按请求次数`
4. 观察统计表格

**预期结果：**
- `stats-requests-table` 可见
- 表格包含列：授权、总请求、成功、失败、限流
- 每行数据与数据库中按 auth key 聚合的统计一致
- 时间范围显示当前选定的周期（5h/周/月）

**对应 data-testid：**
`nav-stats-tab`, `stats-period-filter`, `stats-type-filter`,
`stats-requests-table`, `ratelimit-status-badge`

---

### TC-027: 查看统计面板 — Token 用量统计

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-027 |
| 功能模块 | 统计面板 |
| 前置条件 | 已有请求产生 |

**测试步骤：**

1. 导航到统计面板
2. 在统计类型中切换为 `按 Token 用量`
3. 观察统计内容

**预期结果：**
- `stats-tokens-table` 可见（请求次数表隐藏）
- 表格包含：授权、输入 token、输出 token、总 token
- Token 用量趋势图表 `stats-tokens-chart` 可见
- 图表按所选粒度（小时/天/月）展示趋势

**对应 data-testid：**
`nav-stats-tab`, `stats-type-filter`,
`stats-tokens-table`, `stats-tokens-chart`

---

### TC-028: 切换时间范围

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-028 |
| 功能模块 | 统计面板 |
| 前置条件 | 统计面板已打开 |

**测试步骤：**

1. 在 `stats-period-filter` 中选择 `5h`
2. 等待数据刷新
3. 在 `stats-period-filter` 中选择 `周`
4. 等待数据刷新
5. 在 `stats-period-filter` 中选择 `月`
6. 等待数据刷新

**预期结果：**
- 每次切换后，所有统计表格和图表数据更新
- 数据范围正确反映所选时间窗口
- 加载过程中显示 `loading-spinner`

**对应 data-testid：**
`stats-period-filter`, `stats-requests-table`, `loading-spinner`

---

### TC-029: 按授权筛选统计数据

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-029 |
| 功能模块 | 统计面板 |
| 前置条件 | 已有请求产生，多个授权 |

**测试步骤：**

1. 在 `stats-auth-filter` 中选择特定授权 Key
2. 观察统计数据变化

**预期结果：**
- 统计表格仅显示该授权 Key 的统计数据
- 数据与数据库中该授权的统计一致
- 切换授权后，表格和图表同步更新

**对应 data-testid：**
`stats-auth-filter`, `stats-requests-table`, `stats-tokens-table`

---

### TC-030: Token 用量 — 时间粒度切换

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-030 |
| 功能模块 | 统计面板 / Token |
| 前置条件 | 已有请求产生 |

**测试步骤：**

1. 切换到 `按 Token 用量` 统计类型
2. 在 Token 粒度选择中切换 `小时` → `天` → `月`
3. 观察图表和表格变化

**预期结果：**
- 切换为 `小时` 时，图表按小时粒度展示
- 切换为 `天` 时，图表按天粒度聚合展示
- 切换为 `月` 时，图表按月粒度聚合展示
- 数据随粒度变化正确聚合

**对应 data-testid：**
`stats-type-filter`, `stats-tokens-table`, `stats-tokens-chart`

---

### TC-031: 统计面板无数据时显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-031 |
| 功能模块 | 统计面板 |
| 前置条件 | 无任何请求记录 |

**测试步骤：**

1. 导航到统计面板

**预期结果：**
- 统计表格显示空状态或零值
- 图表区域显示空状态提示
- 不显示错误

**对应 data-testid：**
`nav-stats-tab`, `stats-requests-table`, `stats-tokens-chart`

---

## 8. 端到端流程测试用例

### TC-032: E2E 完整流程 — 单供应商配置 → 请求 → 统计

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-032 |
| 功能模块 | 端到端流程 |
| 前置条件 | 系统初始状态，无任何配置 |

**测试步骤：**

**步骤 1: 创建供应商（包含模型、授权、限流规则）**
1. 点击 `nav-providers-tab`
2. 点击 `provider-add-btn`
3. 填写：名称=`provider_a`, URL=`https://api.openai.com`
4. 添加模型：`gpt-4`
5. 添加授权 Key：`sk-e2e-test-key`
6. 添加限流规则：`requests` / `5h` / `10`
7. 点击 `provider-save-btn`
8. 验证：列表中新增 `provider_a`

**步骤 2: 创建模型别名（选择供应商和模型）**
1. 点击 `nav-models-tab`
2. 点击 `model-add-btn`
3. 填写：别名=`e2e-model`
4. 选择供应商：`provider_a`
5. 选择模型：`gpt-4`（从下拉列表）
6. 点击 `model-save-btn`
7. 验证：列表中新增 `e2e-model`

**步骤 3: 发起请求**（通过 API mock）
1. 向网关发送 POST 请求到 `/v1/chat/completions`
2. 请求体：`{"model": "e2e-model", "messages": [{"role": "user", "content": "Hello"}]}`
3. 请求头：`Authorization: Bearer sk-e2e-test-key`
4. 等待 mock 响应

**步骤 4: 验证统计**
1. 点击 `nav-stats-tab`
2. 观察 `stats-requests-table` 是否有新记录
3. 观察 `stats-total-card` 数值 +1

**步骤 5: 验证限流状态**
1. 点击 `nav-ratelimit-tab`
2. 观察 `ratelimit-list-table` 中该授权的状态

**预期结果：**
- 所有配置步骤成功完成
- 请求正常返回 mock 响应
- 统计数据正确记录
- 限流状态正确反映
- 整个流程无错误

**对应 data-testid：**
`nav-providers-tab`, `provider-add-btn`, `provider-save-btn`,
`nav-models-tab`, `model-add-btn`, `model-save-btn`,
`nav-stats-tab`, `stats-requests-table`, `stats-total-card`,
`nav-ratelimit-tab`, `ratelimit-list-table`

---

### TC-033: E2E 限流触发 → 排队 → 恢复流程

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-033 |
| 功能模块 | 端到端流程 |
| 前置条件 | 已配置供应商和限流规则 |

**测试步骤：**

**步骤 1: 配置低限流阈值**
1. 编辑供应商，设置限流：`requests` / `5h` / `3`

**步骤 2: 触发限流**
1. 通过 mock 发送 3 次请求 → 全部成功
2. 发送第 4 次请求 → 触发限流（返回 429）

**步骤 3: 验证限流状态**
1. 导航到仪表盘
2. 观察 `dashboard-rate-limit-count-card` 计数 +1

**步骤 4: 验证统计**
1. 导航到统计面板
2. 查看 `stats-requests-table`
3. 确认限流计数 +1

**预期结果：**
- 限流正确触发
- 统计正确记录限流事件
- 限流状态一览页显示超限状态

**对应 data-testid：**
`provider-ratelimit-add-btn`, `provider-ratelimit-max-input`,
`dashboard-rate-limit-count-card`, `stats-requests-table`

---

### TC-034: E2E 从仪表盘 → 限流状态一览 → 供应商管理 导航流程

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-034 |
| 功能模块 | 端到端流程 / 导航 |
| 前置条件 | 已创建完整配置 |

**测试步骤：**

1. 导航到仪表盘 `nav-dashboard-tab`
2. 点击 `dashboard-auth-health-row` 中的某一行
3. 验证跳转到限流状态一览页，供应商筛选已设置
4. 在限流状态一览页导航到供应商管理 `nav-providers-tab`
5. 点击某供应商的编辑按钮
6. 查看该供应商的授权 Key

**预期结果：**
- 所有导航跳转正确
- 筛选状态正确传递
- 页面数据正确加载

**对应 data-testid：**
`nav-dashboard-tab`, `dashboard-auth-health-row`,
`nav-ratelimit-tab`, `ratelimit-provider-select`,
`nav-providers-tab`

---

## 9. 异常与边界场景

### TC-035: 供应商不可达

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-035 |
| 功能模块 | 异常处理 |
| 前置条件 | 供应商 URL 配置为无效地址 |

**测试步骤：**

1. 创建供应商，URL 为无效地址（如 `http://invalid-host-12345.com`）
2. 创建授权和模型别名
3. 发起请求
4. 观察错误处理

**预期结果：**
- 请求失败，返回适当错误
- 统计中失败请求计数 +1

**对应 data-testid：**
`stats-requests-table`

---

### TC-036: 别名长度边界

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-036 |
| 功能模块 | 边界场景 |
| 前置条件 | 无 |

**测试步骤：**

1. 创建别名，使用合法最大长度
2. 尝试创建超长别名

**预期结果：**
- 合法长度别名创建成功
- 超长别名创建失败，显示错误提示

**对应 data-testid：**
`model-alias-input`, `model-save-btn`, `error-toast`

---

### TC-037: 限流规则类型切换 — 周期字段显隐（3 种类型）

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-037 |
| 功能模块 | 边界场景 / 限流规则 |
| 前置条件 | 在供应商添加/编辑弹窗中 |

**测试步骤：**

1. 添加限流规则
2. 选择 `concurrency` 类型
3. 确认周期选择器隐藏
4. 切换为 `requests` 类型
5. 确认周期选择器重新显示
6. 切换为 `tokens` 类型
7. 确认周期选择器显示

**预期结果：**
- `concurrency` 类型不显示周期选择
- `requests` 和 `tokens` 类型显示周期选择

**对应 data-testid：**
`provider-ratelimit-type-select`, `provider-ratelimit-period-select`

---

## 10. E2E 执行顺序建议

### 10.1 执行阶段

```
Phase 1: 仪表盘 (TC-001 ~ TC-005)
  → 概览卡片
  → 请求趋势图表
  → 授权健康状态表格
  → 点击授权行跳转
  → 点击限流次数跳转

Phase 2: 模型管理 (TC-006 ~ TC-011b)
  → 添加/编辑/删除模型别名
  → 供应商-模型下拉联动
  → 空状态

Phase 3: 供应商管理 (TC-012 ~ TC-020b)
  → 添加/编辑/删除供应商
  → 模型配置
  → 授权 Key 集成
  → 3 种限流规则 CRUD
  → 周期字段显隐
  → 全功能表单验证

Phase 4: 限流状态一览 (TC-021 ~ TC-025)
  → 查看限流状态
  → 供应商筛选
  → 限流类型明细展示
  → 空状态

Phase 5: 统计面板 (TC-026 ~ TC-031)
  → 请求次数统计
  → Token 用量统计
  → 时间范围切换
  → 授权筛选
  → Token 粒度切换
  → 空状态

Phase 6: 端到端流程 (TC-032 ~ TC-034)
  → 完整配置→请求→统计
  → 限流全流程
  → 导航联动流程

Phase 7: 异常与边界 (TC-035 ~ TC-037)
  → 供应商不可达
  → 别名长度边界
  → 限流规则类型边界
```

### 10.2 前置依赖关系

```
TC-006 (创建模型别名)  依赖 → TC-012 (创建供应商)
TC-019 (授权集成)       依赖 → TC-012 (供应商已存在)
TC-021 (限流状态一览)   依赖 → TC-019 (授权已创建)
TC-032 (E2E 完整流程)   依赖 → TC-012 + TC-019 + TC-006
TC-033 (限流全流程)     依赖 → TC-014
TC-034 (导航联动)       依赖 → TC-001 + TC-021 + TC-012
```

---

## 附录 A: data-testid 完整清单

| Test ID | 元素类型 | 所在页面 | 说明 |
|---------|----------|----------|------|
| `nav-dashboard-tab` | tab | 全局导航 | 仪表盘入口 |
| `nav-models-tab` | tab | 全局导航 | 模型管理入口 |
| `nav-providers-tab` | tab | 全局导航 | 供应商管理入口 |
| `nav-ratelimit-tab` | tab | 全局导航 | 限流状态一览入口 |
| `nav-stats-tab` | tab | 全局导航 | 统计面板入口 |
| `dashboard-total-requests-card` | card | 仪表盘 | 总请求数卡片 |
| `dashboard-active-auths-card` | card | 仪表盘 | 活跃授权卡片 |
| `dashboard-rate-limit-count-card` | card | 仪表盘 | 限流次数卡片 |
| `dashboard-trend-chart` | chart | 仪表盘 | 请求趋势图表 |
| `dashboard-auth-health-table` | table | 仪表盘 | 授权健康状态表格 |
| `dashboard-auth-health-row` | row | 仪表盘 | 健康状态行（可点击） |
| `model-add-btn` | button | 模型列表 | 添加模型别名 |
| `model-alias-input` | input | 模型弹窗 | 别名输入 |
| `model-provider-select` | select | 模型弹窗 | 供应商下拉选择 |
| `model-model-name-select` | select | 模型弹窗 | 模型名称下拉选择 |
| `model-description-input` | input | 模型弹窗 | 描述输入 |
| `model-edit-btn` | button | 模型列表行 | 编辑 |
| `model-delete-btn` | button | 模型列表行 | 删除 |
| `model-save-btn` | button | 模型弹窗 | 保存 |
| `model-list-table` | table | 模型列表 | 数据表格 |
| `model-table-row` | row | 模型列表 | 表格行 |
| `model-add-modal` | modal | 模型管理 | 添加弹窗 |
| `model-edit-modal` | modal | 模型管理 | 编辑弹窗 |
| `model-empty-state` | empty | 模型列表 | 空状态 |
| `provider-add-btn` | button | 供应商列表 | 添加供应商 |
| `provider-name-input` | input | 供应商弹窗 | 供应商名称 |
| `provider-url-input` | input | 供应商弹窗 | 基础 URL |
| `provider-model-add-btn` | button | 供应商弹窗 | 添加模型 |
| `provider-model-name-input` | input | 供应商弹窗 | 模型名称输入 |
| `provider-model-weight-input` | input | 供应商弹窗 | 模型请求倍率输入 |
| `provider-model-cache-hit-price-input` | input | 供应商弹窗 | 模型缓存命中价输入 |
| `provider-model-cache-create-price-input` | input | 供应商弹窗 | 模型建立缓存价输入 |
| `provider-headers-input` | textarea | 供应商弹窗 | 自定义 Headers (JSON) |
| `provider-api-format-select` | select | 供应商弹窗 | API 格式选择 |
| `model-headers-input` | textarea | 模型弹窗 | 模型别名自定义 Headers (JSON) |
| `provider-model-input-price-input` | input | 供应商弹窗 | 模型输入价输入 |
| `provider-model-output-price-input` | input | 供应商弹窗 | 模型输出价输入 |
| `provider-model-remove-btn` | button | 供应商弹窗 | 删除模型 |
| `provider-auth-add-btn` | button | 供应商弹窗 | 添加授权 Key |
| `provider-auth-key-input` | input | 供应商弹窗 | 授权 Key 输入 |
| `provider-auth-name-input` | input | 供应商弹窗 | 授权名称输入 |
| `provider-auth-remove-btn` | button | 供应商弹窗 | 删除授权 |
| `provider-ratelimit-add-btn` | button | 供应商弹窗 | 添加限流规则 |
| `provider-ratelimit-type-select` | select | 供应商弹窗 | 限流类型 |
| `provider-ratelimit-period-select` | select | 供应商弹窗 | 时间周期 |
| `provider-ratelimit-max-input` | input | 供应商弹窗 | 最大限制值 |
| `provider-ratelimit-remove-btn` | button | 供应商弹窗 | 删除限流规则 |
| `provider-queue-timeout-input` | input | 供应商弹窗 | 队列超时（秒） |
| `provider-headers-input` | input | 供应商弹窗 | 自定义 Headers (JSON) |
| `provider-pricing-model-select` | select | 供应商弹窗 | 计费模型选择 |
| `provider-unit-price-input` | input | 供应商弹窗 | 单价 (USD) |
| `provider-subscription-price-input` | input | 供应商弹窗 | 订阅价格 |
| `provider-subscription-period-select` | select | 供应商弹窗 | 订阅周期 |
| `provider-subscription-included-input` | input | 供应商弹窗 | 包含请求数 |
| `provider-subscription-overage-price-input` | input | 供应商弹窗 | 超出单价 |
| `provider-subscription-billing-type-select` | select | 供应商弹窗 | 订阅制计费方式 (weighted_requests/tokens) |
| `provider-subscription-included-tokens-input` | input | 供应商弹窗 | 包含 Token 数 |
| `provider-edit-btn` | button | 供应商列表行 | 编辑 |
| `provider-delete-btn` | button | 供应商列表行 | 删除 |
| `provider-save-btn` | button | 供应商弹窗 | 保存 |
| `provider-list-table` | table | 供应商列表 | 数据表格 |
| `provider-table-row` | row | 供应商列表 | 表格行 |
| `provider-add-modal` | modal | 供应商管理 | 添加弹窗 |
| `provider-edit-modal` | modal | 供应商管理 | 编辑弹窗 |
| `provider-ratelimit-tag` | tag | 供应商列表行 | 限流规则标签 |
| `ratelimit-provider-select` | select | 限流状态页 | 供应商下拉筛选 |
| `ratelimit-list-table` | table | 限流状态页 | 数据表格 |
| `ratelimit-table-row` | row | 限流状态页 | 表格行 |
| `ratelimit-status-badge` | badge | 限流状态页 | 状态徽标 |
| `ratelimit-key-text` | text | 限流状态页 | Key 显示文本 |
| `ratelimit-limit-type-tag` | tag | 限流状态页 | 限流类型标签 |
| `ratelist-empty-state` | empty | 限流状态页 | 空状态 |
| `stats-period-filter` | filter | 统计面板 | 时间范围 (5h/周/月) |
| `stats-type-filter` | filter | 统计面板 | 统计类型 (请求次数/Token用量) |
| `stats-auth-filter` | filter | 统计面板 | 授权筛选 |
| `stats-tab-requests` | tab | 统计面板 | 请求次数统计 |
| `stats-tab-tokens` | tab | 统计面板 | Token 用量统计 |
| `stats-requests-table` | table | 统计面板 | 请求统计表 |
| `stats-tokens-table` | table | 统计面板 | Token 统计表 |
| `stats-tokens-chart` | chart | 统计面板 | Token 趋势图表 |
| `confirm-delete-dialog` | dialog | 全局 | 删除确认 |
| `confirm-delete-btn` | button | 确认对话框 | 确认删除 |
| `confirm-cancel-btn` | button | 确认对话框 | 取消 |
| `currency-select` | select | 全局导航栏 | 货币选择下拉框 |
| `currency-select-label` | text | 全局导航栏 | 当前货币显示文本 |
| `success-toast` | toast | 全局 | 成功提示 |
| `error-toast` | toast | 全局 | 错误提示 |
| `loading-spinner` | spinner | 全局 | 加载动画 |

---

*文档版本: Phase 2 v3.0 (基于需求修正版 — 简化 auths、3 种限流类型、简化统计面板、模型下拉列表)*
*最后更新: 2026-05-30*

---

## 12. 汇率与货币显示测试用例

### TC-CURR-001: 全局货币选择器显示

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-CURR-001 |
| 功能模块 | 汇率/货币 |
| 前置条件 | 系统已运行 |

**测试步骤：**
1. 导航到仪表盘页面
2. 观察导航栏右上角

**预期结果：**
- `currency-select` 下拉选择器可见
- 默认显示 "USD"
- 下拉选项包含：USD, CNY, EUR, JPY, GBP, HKD, TWD, KRW, SGD

**对应 data-testid：**
`currency-select`, `currency-select-label`

---

### TC-CURR-002: 切换货币后仪表盘金额换算

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-CURR-002 |
| 功能模块 | 汇率/货币 |
| 前置条件 | 仪表盘有数据，总花费 > 0 |

**测试步骤：**
1. 导航到仪表盘页面
2. 记录当前 USD 下的总花费值
3. 切换货币选择器为 "CNY"
4. 观察总花费卡片

**预期结果：**
- 总花费数值发生变化（乘以对应汇率）
- 货币符号变为 ¥
- 数值保留 2 位小数
- 其他金额区域（各区段）同步更新

**对应 data-testid：**
`currency-select`, `dashboard-total-cost-card`

---

### TC-CURR-003: 货币偏好持久化

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-CURR-003 |
| 功能模块 | 汇率/货币 |
| 前置条件 | 无 |

**测试步骤：**
1. 切换货币为 "EUR"
2. 刷新页面

**预期结果：**
- 货币选择器仍显示 "EUR"
- 仪表盘金额仍以 EUR 显示

**对应 data-testid：**
`currency-select`

---

### TC-CURR-004: 汇率 API 返回数据

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-CURR-004 |
| 功能模块 | 汇率/货币 |
| 前置条件 | 系统已运行 |

**测试步骤：**
1. 调用 GET /api/rates

**预期结果：**
- 返回 JSON 包含 `base: "USD"`
- 包含 `rates` 对象
- 包含 `updated_at` 时间戳
- 货币列表包含 CNY, EUR, JPY, GBP, HKD, TWD, KRW, SGD

---

### TC-CURR-005: 前端 placeholder 随货币切换更新

| 字段 | 值 |
|------|-----|
| 用例 ID | TC-CURR-005 |
| 功能模块 | 汇率/货币 |
| 前置条件 | 系统已运行，已进入供应商页面 |

**测试步骤：**
1. 导航到供应商页面
2. 点击 [+ 添加供应商] 打开表单
3. 在 USD 下，观察单价输入框的 placeholder
4. 切换货币为 CNY
5. 观察单价输入框的 placeholder

**预期结果：**
- USD 下 placeholder 显示 "0.001"
- 切换到 CNY 后 placeholder 更新为换算后的值（约 "0.007"）
- 货币符号同步更新
