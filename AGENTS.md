# LLM Proxy Gateway — Agent 准则

## 核心规则

1. **先思考再编码**。明确假设，表面权衡，有更简单方案时提出反对。
2. **简单优先**。最小代码解决问题，不做推测性功能，不写一次性抽象。
3. **精准改动**。只修改任务涉及的代码，匹配现有风格，不自作聪明。
4. **目标驱动**。先定义成功标准，持续验证直到达成。
5. **确定性代码**。限流、路由、算术等用代码实现，不要用提示词让模型做。
6. **硬 token 预算**。循环设上限，长时间无进展时停下来。
7. **显式冲突**。代码不一致时选一个并说明原因，不要两个都保留。
8. **先读后写**。新增代码前先读附近代码，避免重复。
9. **测试验证行为**。断言要针对行为，不是形状。
10. **长操作留检查点**。多步重构要分步提交。
11. **惯例优于创新**。有既定模式就用既定模式。
12. **显式失败**。部分失败要明确报告，不要伪装成功。

## 项目约定

- TypeScript only，最新语法
- Yarn Workspaces monorepo
- oxlint 校验，biome/oxformat 格式化
- 前端不用 Pinia/Vuex，用 composables + provide/inject
- UnoCSS only，无手写 CSS
- Kysely 数据库，无裸 SQL（除 migration）
- Hono 路由
- Vitest 测试

## Agent 角色分工

- **后端开发**: Hono 服务器 + 配置 + 池 + 限流 + 转换 + 统计 + 单元测试
- **前端开发**: Vue 3 SPA + Reka UI + UnoCSS + 管理界面 + 组件测试
- **测试工程师**: API 接口测试 + 集成测试 + E2E 联调

## 质量门 (Quality Gate)

每个阶段交付前必须通过 `yarn validate`，不通过不得合并/进入下一阶段。

**质量门流水线**（按顺序执行，失败即停）：

1. **Lint 通过** — `yarn lint`（oxlint 无错误）
2. **TypeCheck 通过** — `yarn typecheck`（tsc --noEmit 通过）
3. **Test 通过** — `yarn test`（vitest run 全部通过）

**规则：**
- `yarn validate` 按顺序运行三项检查，任一失败立即停止
- 不通过 `yarn validate` 的代码不得合并或进入下一阶段
- 格式检查：`yarn format:check`（biome）合并前也应通过
- 修复顺序：lint → format → typecheck → test
