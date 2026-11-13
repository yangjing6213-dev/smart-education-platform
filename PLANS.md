# 当前实施与发布摘要

更新时间：2026-11-13。该文件是公开源码中的精简状态记录；完整本机执行历史不随源码发布。当前唯一有效实施摘要见 [剩余实施计划](docs/exec-plans/active/project-completion.md)。

已完成且有实际证据的检查：

- 本地 15 项发布矩阵通过。A1.539 的文件树后验问题已补验闭合，A1.562 保留 12 项有效结果并重新验证 3 项 Mini 检查。
- 固定 Taro 小程序完成首页、家长申请、员工审核、家长回读，以及成长记录草稿、提交、审核、发布、家长查看的实际点击验证；重复提交验证通过。
- 网站 Linux 构建包通过检查及云端回环地址的私有试运行；临时进程和监听已清理。这不是公网网站部署完成。
- API 网关固定模板已核对大小及 SHA-256，结果 MATCH。此前 UNKNOWN 原因是普通账号无权读取 root 私有模板，未修改服务器权限或配置。
- 新 API 运行包的 231 个业务 JavaScript 文件已准备；尚未部署。测试输出中的 344 个 JavaScript 文件包含非业务运行文件，不能直接作为线上版本计数。

当前工作是核对线上后端兼容性、完成 GitHub 源码提交和推送、部署网站，再上传固定 Mini 包并按微信流程审核发布。平台审核通过前不能称小程序已发布；每个外部动作均以独立回执为准。

目标为现有 GitHub 仓库 `yangjing6213-dev/smart-education-platform` 的 `feature/phase-1b-task-19-final-delivery-acceptance` 分支、`www.enhe-tongxin.com` 网站、`api.enhe-tongxin.com` API 和既有微信 AppID `wxd504f4d0eba35411`。不新增付费资源，不使用真实儿童业务资料或生产数据库。

机构实拍不进入公开源码。干净 checkout 需要先准备已授权私有素材才能构建 Mini 首页，步骤见 [私有照片准备](docs/operations/private-photos.md)。已经验证的部署产物含获授权实拍；不能将“源码已推送”理解为“网站或小程序已上线”。
