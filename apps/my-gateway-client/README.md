# LLM Proxy Gateway — Desktop Client

基于 [Electrobun](https://electrobun.dev) 构建的原生 macOS 桌面应用。

## 架构

```
Electrobun 应用 (单一进程)
├─ Bun 运行时
│  ├─ import createApp → 初始化后端 (Hono + bun:sqlite)
│  ├─ Bun.serve → API + 前端静态文件 (同一端口 :9000)
│  └─ BrowserWindow → 原生窗口加载前端
└─ 数据存储
   ├─ 开发: 项目根 config/ + data/
   └─ 生产: .app bundle 内 Resources/ + ~/Library/Application Support/
```

## 三模式路径系统

`src/bun/index.ts` 中的 `detectMode()` 自动判断当前运行环境：

| 场景 | 触发条件 | Config | 数据库 | 前端 |
|------|---------|--------|--------|------|
| **开发** | `DEV_WORKSPACE` 已设置 | `$DEV_WORKSPACE/config/` | `$DEV_WORKSPACE/data/dev.db` | `$DEV_WORKSPACE/packages/frontend/dist/` |
| **生产** | 路径含 `.app/Contents/` | `Resources/config/` | `~/Library/Application Support/LLM Proxy Gateway/data/gateway.db` | `Resources/frontend/` |
| **测试** | `VITEST=1` | `$TMPDIR/llm-proxy-gateway-test/config/` | `$TMPDIR/llm-proxy-gateway-test/data/test.db` | `$TMPDIR/llm-proxy-gateway-test/frontend/` |

### 路径可靠性保障

- **数据库路径**：自动检测父目录是否可写，不可写时依序尝试 `~/`、`/tmp`、CWD
- **前端资源**：检测 `index.html` 是否存在，不存在时显示 fallback 页面（API 仍然可用）
- **Config**：不存在时后端自动降级为空配置（零配置启动）

## 快速开始

```bash
# 开发模式
cd apps/my-gateway-client
yarn dev
# 或: DEV_WORKSPACE=$(cd ../.. && pwd) bunx electrobun dev
```

## 构建分发

```bash
cd apps/my-gateway-client

# 完整构建：编译前端 → electrobun build → 打包资源
yarn build

# 产出的 .app 在 build/ 目录
open build/*/LLM\ Proxy\ Gateway*.app
```

构建脚本 (`scripts/bundle-resources.sh`) 自动将 `config/` 和 `packages/frontend/dist/` 复制到 `.app/Contents/Resources/` 内。

## 项目结构

```
apps/my-gateway-client/
├── src/
│   └── bun/
│       └── index.ts                  # 主进程：模式检测 → 路径解析 → 初始化 → 开窗口
├── scripts/
│   └── bundle-resources.sh           # 生产构建资源打包脚本
├── electrobun.config.ts              # Electrobun 构建配置
├── package.json
├── tsconfig.json
└── README.md
```

## 环境要求

- [Bun](https://bun.sh) >= 1.0
- Node.js 24（仅构建前端时需要）
- macOS
