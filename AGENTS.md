# Fs.Fox.CAD.Site 协作规则

本文件适用于整个仓库。

## 事实源边界

- 产品内容唯一事实源是 [FsDiG/Fs.Fox.CAD](https://github.com/FsDiG/Fs.Fox.CAD)。
- 本仓库只维护展示、渲染、来源获取和部署实现；不要在此新增或修补产品指南、API 语义、兼容性结论或完整示例。
- 发现产品内容错误时，在 Fs.Fox.CAD 提交修正，再更新来源锁。
- 本仓库 README 和 `docs` 只说明如何维护站点，不作为 Fs.Fox.CAD 产品帮助正文。

## 来源与生成内容

- `config/content-source.json` 必须使用完整 40 位 commit 和匹配的 Git tree 摘要。
- `latest` 由同步 workflow 推进；`stable` 只能由明确 Release tag 推进。
- 不在构建期间直接读取浮动 `main`，不使用可移动 tag 代替已解析 commit。
- `.cache`、`dist`、生成 API、搜索索引、DLL/XML 副本和其他可重建输出不得提交。
- 不把 GitHub/EdgeOne token、部署钩子、环境变量值或域名凭据写入 Git、日志或前端 bundle。

## 实施边界

- 最终站点框架尚未决定。框架引入必须以相同内容集完成 POC，并记录 EdgeOne 构建时间、输出文件数、中文搜索、API 变体和专有语法成本。
- 源 Markdown 必须保持 GFM 和框架无关元数据；框架专有组件留在展示适配层。
- ObjectARX/ZRX 相关程序集和 API 数据只能由 Fs.Fox.CAD 的 Windows/CAD SDK CI 生成，不能在 EdgeOne 构建环境编译。
- EdgeOne 连接、区域、域名、备案和证书由仓库所有者处理；代码不得假设这些云配置已经完成。

## 验证

变更至少执行：

```powershell
npm ci
npm run check
npm run source:verify
npm run build
git diff --check
```

修改 workflow 时同时检查最小 `permissions`、不受信任 PR 的 secret 边界，以及失败是否返回非零退出码。
