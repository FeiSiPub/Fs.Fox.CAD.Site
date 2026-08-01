# Fs.Fox.CAD.Site

Fs.Fox.CAD 文档的展示与部署实现仓库。

> 状态：Bootstrap<br>
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
  -> 生成 dist/index.html + dist/build-manifest.json
```

当前页面只是用于验证来源、构建和 EdgeOne 接入的启动页，不是最终文档站点，也不代表已经选择站点框架。

## 本地命令

前置条件：Node.js 20+、Git。

```powershell
npm ci
npm run check
npm run source:verify
npm run build
```

构建输出位于 `dist`，源码缓存位于 `.cache/source`；两者均被 Git 忽略。

## 来源同步

- `Update Fs.Fox.CAD source lock` workflow 每 6 小时检查一次公开源仓库 main，并支持手工触发。
- workflow 只在完整 source commit 变化时更新 `latest` 并提交。
- receiver 已接受 `fs-fox-cad-source-updated` 类型的 `repository_dispatch`，为后续 GitHub App 事件触发预留入口。
- `stable` 不随 main 自动变化，只能通过明确的 Release tag 更新。

生产级跨仓事件身份和分支保护由 [Issue #1](https://github.com/FsDiG/Fs.Fox.CAD.Site/issues/1) 跟踪；当前定时 reconciliation 是不依赖跨仓密钥的启动方案。完整契约见 [来源集成说明](docs/source-integration.md)。

## EdgeOne 接入

仓库所有者可以在 EdgeOne Makers 导入本 GitHub 仓库，并使用：

- 部署分支：`main`
- Node.js：`22.11.0` 或兼容的 Node 22
- 安装命令：`npm ci`
- 构建命令：`npm run build`
- 输出目录：`dist`

在最终框架选型前，EdgeOne 只会部署来源连接状态页。不要把 EdgeOne 直接连接到 `Fs.Fox.CAD`，也不要把 API Token、部署钩子或域名凭据提交到本仓库。

腾讯云侧连接参数、所有者决策和验收清单由 [Issue #2](https://github.com/FsDiG/Fs.Fox.CAD.Site/issues/2) 跟踪。

## 许可证

站点实现使用 [MIT License](LICENSE)。从 Fs.Fox.CAD 获取的内容仍遵循其来源仓库许可证与归属。
