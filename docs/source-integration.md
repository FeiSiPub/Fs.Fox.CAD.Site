# Fs.Fox.CAD 来源集成契约

> 状态：当前启动契约（Current）<br>
> 日期：2026-08-02<br>
> 跟踪：[Fs.Fox.CAD Issue #48](https://github.com/FsDiG/Fs.Fox.CAD/issues/48)

## 1. 目的

本仓库从 `FsDiG/Fs.Fox.CAD` 获取产品文档和后续 API 数据，但不拥有这些内容。集成链路必须同时满足：

- 每次构建对应确定的 source commit；
- `latest` 与 `stable` 独立推进；
- 站点仓库不复制维护产品 Markdown；
- 没有跨仓密钥时仍能恢复同步；
- EdgeOne 只需连接本仓库；
- 失败可以从 Git 来源锁重建，而不依赖 EdgeOne 保存旧物料。

## 2. 来源锁

[`config/content-source.json`](../config/content-source.json) 是唯一来源入口：

```json
{
  "schema_version": 1,
  "source_repository": "FsDiG/Fs.Fox.CAD",
  "channels": {
    "latest": {
      "ref": "main",
      "commit": "<40-character-commit>",
      "content_digest": "git-tree:<40-character-tree>"
    },
    "stable": {
      "tag": "<release-tag>",
      "commit": "<40-character-commit>",
      "content_digest": "git-tree:<40-character-tree>"
    }
  }
}
```

当前 `content_digest` 使用整个 source commit 的 Git tree。它优先保证来源确定性，尚未优化为“只包含已发布文档/API 输入”的摘要。后续 API 数据包建立后，可在保持 schema 版本兼容或明确升级的前提下增加更细粒度摘要。

规则：

1. 所有 commit 和 tree 必须为完整 40 位小写 SHA-1。
2. `latest.ref` 固定为 `main`，只用于同步工具查询；构建只读取 `latest.commit`。
3. `stable.tag` 用于展示和校验；构建只读取已解析的 `stable.commit`。
4. `stable` 不由定时任务自动升级。
5. 锁文件不保存 token、临时下载 URL、EdgeOne 项目 ID 或域名配置。

## 3. 精确来源获取

`scripts/acquire-source.mjs` 执行以下步骤：

1. 校验来源锁 schema、固定仓库名、commit 和 Git tree；
2. 在 `.cache/source/<commit>` 初始化临时 Git 仓库；
3. 从公开源仓库只 fetch 锁定 commit；
4. detached checkout `FETCH_HEAD`；
5. 校验实际 `HEAD` 和 `HEAD^{tree}`；
6. 向后续构建提供缓存路径。

脚本不会自动删除已有的异常缓存目录。若缓存存在但 commit/tree 不匹配，它会失败并要求维护者明确清理 `.cache`，避免错误路径导致超范围删除。

## 4. 当前同步模型

### 4.1 Bootstrap pull/reconciliation

`.github/workflows/update-source-lock.yml` 当前支持：

- 每 6 小时定时检查 source `main`；
- GitHub UI 手工触发；
- 接收 `fs-fox-cad-source-updated` 类型的 `repository_dispatch`。

workflow 使用 GitHub API 读取公开 source main。若 commit 未变化则不写文件、不提交，也不会产生新的站点仓库 push。若变化则更新 `latest.commit` 和 Git tree，以 `github-actions[bot]` 提交到 `main`。

定时同步是启动和灾难恢复路径，不需要在两个仓库间共享个人 token。其代价是最多 6 小时延迟，并且当前整个 source tree 的任何变化都会推进 latest。

### 4.2 目标事件模型

生产目标仍是事件驱动：

```text
Fs.Fox.CAD main 内容/API 输入验证成功
  -> GitHub App 创建 repository_dispatch
  -> Fs.Fox.CAD.Site 重新查询并校验 source main
  -> 更新来源锁
  -> 站点仓库 push
  -> EdgeOne 自动构建
```

GitHub App 应只安装到 `Fs.Fox.CAD.Site`。GitHub REST 当前要求创建 repository dispatch 的细粒度身份具有目标仓库 `Contents: write`，因此不能把它描述为纯只读权限。App 私钥、安装范围、轮换和撤销需要在启用前单独审查，实施与权限决策由 [Issue #1](https://github.com/FeiSiPub/Fs.Fox.CAD.Site/issues/1) 跟踪。

receiver 不执行 dispatch payload 提供的 URL、命令或任意仓库。它只接受固定 `source_repository`，然后自行从 GitHub 查询 `FsDiG/Fs.Fox.CAD/main`，降低伪造 payload 的影响。

## 5. `stable` 更新

当前 stable 锁定源仓库正式 Release `v1.0.3`。新 stable 必须在对应 NuGet Release 构建、检查和发布成功后手工或由受控 Release 事件执行：

```powershell
npm run source:update-stable -- vX.Y.Z
npm run source:verify
```

提交前必须确认 tag、解析 commit、包版本和后续 API 数据包属于同一来源。普通 main push 和定时任务不得改变 stable。

## 6. VitePress 2 POC 构建

`npm run build` 会获取 latest 精确 commit，并执行以下阶段：

1. `scripts/prepare-content.mjs` 验证已获取源码中的 `README.md` 和 `docs/README.md`；
2. 在 `.cache/content/<commit>` 生成 4 个占位 Markdown 和标准化 `content-manifest.json`；
3. 精确锁定的 `vitepress@2.0.0-alpha.19` 生成导航、带中英文分词适配的本地搜索和静态页面；
4. `scripts/write-build-manifest.mjs` 写入 source/site commit、Git tree、VitePress 版本、页面路由和输出规模。

占位 Markdown 只存在于被 Git 忽略的构建目录，明确标记真实产品内容尚未接入。它们用于跑通渲染核心流程，不是产品帮助正文，也不会成为第二个内容事实源。

下一阶段由 `Fs.Fox.CAD` 提供框架无关的 `docs/publication.yml` 和页面元数据。适配器根据稳定 ID、公开状态和 route 生成相同内容清单，再以真实页面替换占位页。VitePress 专有配置仍留在本站，不写回源 Markdown。

## 7. EdgeOne 交接

仓库所有者在 EdgeOne Makers 中连接 `FeiSiPub/Fs.Fox.CAD.Site`，而不是 source 仓库。POC 参数：

| 配置 | 值 |
| --- | --- |
| 分支 | `main` |
| Node | `22.12.0` 或更高的兼容版本 |
| 安装 | `npm ci` |
| 构建 | `npm run build` |
| 输出 | `dist` |

EdgeOne 连接前后都不需要修改来源锁 schema。区域、正式域名、备案、HTTPS 和证书不保存在 Git 中，由仓库所有者在腾讯云侧配置并在 [Issue #2](https://github.com/FeiSiPub/Fs.Fox.CAD.Site/issues/2) 记录决策和验收结果。

## 8. 故障与恢复

| 故障 | 处理 |
| --- | --- |
| source main 已前移但锁未更新 | 手工运行 Update source lock workflow；事件模型建立后检查 GitHub App。 |
| 锁定 commit 无法获取 | 停止部署，核对 source 历史和仓库可见性；不回退到浮动 main。 |
| Git tree 不匹配 | 立即失败；检查锁或缓存，不继续渲染。 |
| workflow 无写权限 | 保留读取/校验结果，修正站点仓库 Actions 权限；不使用个人长期 token 绕过。 |
| EdgeOne 构建失败 | 保持上一成功部署，修复站点代码或 revert 来源锁后重建。 |
| EdgeOne 旧物料被清理 | 从站点 Git commit 和来源锁重建，不依赖控制台旧记录。 |

## 9. 后续门槛

进入最终框架和 API 阶段前仍需：

- 在 source 仓库定义 `docs/publication.yml` 与 published/front matter schema；
- 用 3 至 5 篇真实 Markdown 替换占位页，完成链接、资源和稳定路由适配；
- 生成与 source commit 绑定的 AutoCAD/ZWCAD API 数据包；
- 决定数据包使用 Release asset、Packages/OCI 或 COS；
- 创建最小权限 GitHub App 并完成事件触发；
- 验证 EdgeOne preview、构建配额、域名和回滚。

这些事项不阻塞当前精确来源获取和 VitePress 2 占位 POC 部署链路。
