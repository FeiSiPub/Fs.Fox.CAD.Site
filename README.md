# Fs.Fox.CAD.Site

Fs.Fox.CAD 文档的展示与部署实现仓库。

> 状态：VitePress 2 POC（占位内容）<br>
> 产品内容源：[FsDiG/Fs.Fox.CAD](https://github.com/FsDiG/Fs.Fox.CAD)<br>
> 架构跟踪：[Fs.Fox.CAD Issue #48](https://github.com/FsDiG/Fs.Fox.CAD/issues/48)<br>
> EdgeOne：尚未连接，由仓库所有者在腾讯云控制台完成

## 仓库边界

本仓库负责：

- 站点框架、主题、布局和展示组件；
- 文档/API 数据的渲染适配；
- 搜索、导航和部署配置；
- `latest` / `stable` 的精确来源锁；
- EdgeOne Makers 构建入口。

本仓库不负责：

- 人工维护 Fs.Fox.CAD 产品指南、API 说明或示例；
- 修改公共 API 语义、兼容性结论或维护者契约；
- 保存生成 HTML、搜索索引、下载的源码缓存或 DLL/XML 副本。

产品正文、XML 注释和示例只在 [Fs.Fox.CAD](https://github.com/FsDiG/Fs.Fox.CAD) 修改。本站构建按 [`config/content-source.json`](config/content-source.json) 获取确定的 source commit。

## 当前可运行链路

```text
Fs.Fox.CAD main / v1.0.3
  -> content-source.json（完整 commit + Git tree）
  -> 精确 SHA fetch 到 .cache/source/<commit>
  -> 校验 HEAD 与 tree
  -> 生成 .cache/content/<commit> 占位 Markdown + 内容清单
  -> VitePress 2 构建中文导航、本地搜索和静态页面
  -> dist + build-manifest.json
```

当前精确锁定 `vitepress@2.0.0-alpha.19` 作为 POC 渲染器。构建生成 4 个占位页面，用于验证来源、路由、导航、中文搜索、静态输出和 EdgeOne 接入；它们不包含产品帮助正文，也不代表 VitePress 2 已成为不可替换的长期框架。

源码仓库加入框架无关的 `docs/publication.yml` 后，内容适配器才会选择并转换真实 Markdown。届时 VitePress 配置仍只消费标准化内容清单，不在本站重新维护产品导航事实。

## 本地命令

前置条件：Node.js 22.12+、Git。

```powershell
npm ci
npm run check
npm run source:verify
npm run build
npm run dev
```

构建输出位于 `dist`，源码与临时 Markdown 位于 `.cache/source` 和 `.cache/content`；这些目录均被 Git 忽略。`npm run dev` 默认在 `http://127.0.0.1:5173` 启动本地站点。

## 来源同步

- `Update Fs.Fox.CAD source lock` workflow 每 6 小时检查一次公开源仓库 main，并支持手工触发。
- workflow 只在完整 source commit 变化时更新 `latest` 并提交。
- receiver 已接受 `fs-fox-cad-source-updated` 类型的 `repository_dispatch`，为后续 GitHub App 事件触发预留入口。
- `stable` 不随 main 自动变化，只能通过明确的 Release tag 更新。

生产级跨仓事件身份和分支保护由 [Issue #1](https://github.com/FeiSiPub/Fs.Fox.CAD.Site/issues/1) 跟踪；当前定时 reconciliation 是不依赖跨仓密钥的启动方案。完整契约见 [来源集成说明](docs/source-integration.md)。

## EdgeOne 接入

仓库所有者可以在 EdgeOne Makers 导入本 GitHub 仓库，并使用：

- 部署分支：`main`
- Node.js：`22.12.0` 或更高的兼容版本
- 安装命令：`npm ci`
- 构建命令：`npm run build`
- 输出目录：`dist`

当前 EdgeOne 会部署 VitePress 2 POC 占位站点；真实产品内容仍未接入。不要把 EdgeOne 直接连接到 `Fs.Fox.CAD`，也不要把 API Token、部署钩子或域名凭据提交到本仓库。

腾讯云侧连接参数、所有者决策和验收清单由 [Issue #2](https://github.com/FeiSiPub/Fs.Fox.CAD.Site/issues/2) 跟踪。

## 许可证

站点实现使用 [MIT License](LICENSE)。从 Fs.Fox.CAD 获取的内容仍遵循其来源仓库许可证与归属。
