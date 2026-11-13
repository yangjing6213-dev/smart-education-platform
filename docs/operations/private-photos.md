# 私有照片与源码构建

网站及小程序展示使用三张已获对客展示授权的机构实拍照片。照片没有包含在公开 GitHub 源码中；展示授权不等于允许从公开源码仓库下载、再分发原图。请勿把原图、私人素材目录、客户资料或凭据提交到 Git。

维护者从自己的受限素材存储取得下列原始 JPEG 文件，放入同一个本机目录，并按以下名称保存。脚本只接受经过固定 SHA-256 核对的这三张照片，不下载素材，也不接受替代图片：

- `institution-activity-visit.jpg`
- `teacher-team-outdoor.jpg`
- `teacher-team-campus.jpg`

在仓库根目录使用 Node.js 执行，替换示例中的私有素材目录：

```powershell
node scripts/prepare-private-photos.mjs --source 'D:\private-tongxin-photos' --check
node scripts/prepare-private-photos.mjs --source 'D:\private-tongxin-photos'
```

第一条只检查，成功显示 `PASS_CHECK_ONLY`。第二条将照片分别复制到 `apps/user-web/public/assets/` 与 `apps/mini-program-taro/src/assets/`，成功显示 `PASS_PRIVATE_ASSETS_READY`。全部来源及目标先检查，再创建缺失文件；已有相同文件跳过，其他内容拒绝覆盖。符号链接、非 JPEG、哈希不匹配或读写时变化均停止。无权限取得照片时不能构建包含这些照片的 Mini 首页；请联系项目维护者取得获授权素材，不要自行从公开页面抓取。

源码候选与已验证网站及 Mini 发布产物的业务实现相同。发布产物已经包含获授权的实拍；公开源码缺省不包含照片，只有按上述流程补入固定素材后才具有相同的构建输入。本脚本不会修改已验证发布包。构建与发布仍按相应包清单、哈希及验证记录执行。

照片准备后可执行现有构建命令。正式 Git 提交仍按明确源码清单进行，不能使用 `git add .` 或 `git add -A`。
