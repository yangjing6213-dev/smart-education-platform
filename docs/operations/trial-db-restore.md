# 试用数据库恢复与重新开放

恢复旧备份可能让已注销的账号会话、已换掉的接送码重新有效，也可能缺少备份之后登记的离校记录。新库从创建起只允许运维连接。网站、小程序、定时任务及其他写入者保持停用，直到负责人完成账实核对。

## 1. 留下可验证的备份

以下命令供受权运维在 PostgreSQL 16 的 Linux 工具环境中执行，需要 `psql`、`createdb`、`pg_dump`、`pg_restore` 和 `sha256sum`。本机演练只用合成数据。准备两个权限受限的 libpq 服务配置。`sc_backup_source` 指向源业务库，`sc_restore_control` 指向独立初始化、尚未连接应用的恢复集群维护库。配置中写明各自的主机、端口、数据库和操作身份，认证通过受保护的本地配置提供。

源库备份身份须能完整读取业务表和序列。目标运维身份须能创建数据库、恢复对象并清理所有机构的旧凭证。表权限或行级访问策略妨碍完整备份或清理时，停止并核对专用运维角色。

在同一 shell 设置 `PGSERVICEFILE` 为服务配置绝对路径，`BACKUP_DIR` 为受限存储中尚不存在的绝对目录，`OPS_DIR` 为本版本包含配套 SQL 的运维目录。先停止写入并记录维护开始时间、应用版本、迁移版本和现场交接登记的截止点。如果从早先的定期备份恢复，需从其记录的截止点开始对账。

~~~sh
set -eu
umask 077
: "${PGSERVICEFILE:?}" "${BACKUP_DIR:?}"
export PGSERVICEFILE
mkdir -- "$BACKUP_DIR"
ARCHIVE="$BACKUP_DIR/trial.dump"
psql -XAt -v ON_ERROR_STOP=1 -d 'service=sc_backup_source' \
  -c 'SELECT current_database(), system_identifier, clock_timestamp(), pg_current_wal_lsn() FROM pg_catalog.pg_control_system()'
pg_dump --format=custom --no-owner --no-acl -d 'service=sc_backup_source' -f "$ARCHIVE"
chmod 400 "$ARCHIVE"
sha256sum "$ARCHIVE"
~~~

把源集群编号、恢复点、归档 SHA-256 和版本记入独立受控的备份登记。归档包含业务数据与认证材料，保存在加密且限权的备份位置，按机构保留期限处理。演练仅在临时内存磁盘保留归档。

## 2. 恢复到全新的隔离库

从备份登记取出 `SOURCE_CLUSTER_ID` 和 `BACKUP_SHA256`，从独立恢复集群的创建记录取出 `RESTORE_CLUSTER_ID`。两个编号均应按原样使用十进制数字。设置 `ARCHIVE` 为只读归档路径，`RESTORE_DB` 为本次独占的新库名，例如 `sc_restore_trial_001`。继续使用上一步的 `PGSERVICEFILE` 和 `OPS_DIR`。相应运维账号需能读取 `pg_control_system()`。执行整段，任一命令失败即停止，保留现场。

~~~sh
set -eu
: "${PGSERVICEFILE:?}" "${OPS_DIR:?}" "${ARCHIVE:?}" "${RESTORE_DB:?}" "${SOURCE_CLUSTER_ID:?}" "${RESTORE_CLUSTER_ID:?}" "${BACKUP_SHA256:?}"
export PGSERVICEFILE
export LC_ALL=C
case "$RESTORE_DB" in *[!a-z0-9_]*) exit 1 ;; esac
printf '%s\n' "$RESTORE_DB" | grep -Eq '^sc_restore_[a-z0-9_]{1,40}$'
case "$SOURCE_CLUSTER_ID" in 0*|*[!0-9]*) exit 1 ;; esac
case "$RESTORE_CLUSTER_ID" in 0*|*[!0-9]*) exit 1 ;; esac
case "$BACKUP_SHA256" in *[!0-9a-fA-F]*) exit 1 ;; esac
test "${#BACKUP_SHA256}" -eq 64
actual_sha=$(sha256sum < "$ARCHIVE")
expected_sha=$(printf '%s' "$BACKUP_SHA256" | tr 'A-F' 'a-f')
test "${actual_sha%% *}" = "$expected_sha"
pg_restore --list "$ARCHIVE" >/dev/null
CONTROL='service=sc_restore_control'
TARGET="$CONTROL dbname=$RESTORE_DB"
target_cluster=$(psql -XAt -v ON_ERROR_STOP=1 -d "$CONTROL" -c 'SELECT system_identifier FROM pg_catalog.pg_control_system()')
test "$target_cluster" = "$RESTORE_CLUSTER_ID" && test "$target_cluster" != "$SOURCE_CLUSTER_ID" || { echo '恢复集群与登记不符，操作已停止' >&2; exit 1; }
createdb --maintenance-db="$CONTROL" --template=template0 -- "$RESTORE_DB"
restore_oid=$(psql -XAt -v ON_ERROR_STOP=1 -d "$TARGET" -c 'SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()')
test -n "$restore_oid"
printf '恢复集群 %s，数据库 %s，OID %s\n' "$target_cluster" "$RESTORE_DB" "$restore_oid"
pg_restore --single-transaction --exit-on-error --no-owner --no-acl -d "$TARGET" "$ARCHIVE"
psql -X -v ON_ERROR_STOP=1 -d "$TARGET" -v restore_cluster="$RESTORE_CLUSTER_ID" -v restore_db="$RESTORE_DB" -v restore_oid="$restore_oid" \
  -f "$OPS_DIR/trial-db-quarantine.sql"
remaining=$(psql -XAt -v ON_ERROR_STOP=1 -d "$TARGET" \
  -c 'SELECT (SELECT count(*) FROM public.invite_auth_sessions), (SELECT count(*) FROM public.pickup_credentials WHERE consumed_at IS NULL AND invalidated_at IS NULL)')
printf '%s\n' "$remaining"
test "$remaining" = '0|0'
~~~

最后一行应为 `0|0`。已有同名库会在创建步骤报错。还原中断或脚本报错时隔离该库，排除原因后用新的库名重做。凭证清理本身可在同一恢复库安全重复执行，每次必须使用创建时记录的集群编号、库名和 OID。保留已使用、已作废的凭证和历史业务记录。

上述命令省略源库对象的所有者和授权。恢复负责人须依据受控版本的权限配置，为试用环境的运行账号重新授予所需权限，并用该账号验证。业务应用使用独立的最小权限身份。

## 3. 核对后恢复访问

| 谁核对 | 开放前必须取得的结果 |
| --- | --- |
| 运维 | 迁移、机构/校区、已批准绑定、交接与考勤的计数及抽查内容和备份登记一致。核对应用与数据库版本、最小权限及目标环境的角色授权。用独立角色检查跨机构、跨校区读取被拒。 |
| 当班负责人 | 逐项核对恢复点至停写时刻的接送、离校及更正，尤其是已接走的孩子。用原库可信记录、独立交接台账或核准的日志恢复缺口。确认每次交接只有一条对应离校，避免重复放行。 |
| 账号管理员 | 对照恢复点后账号停用、凭据更换、人员权限、监护关系及接送人变更。先补齐这些撤销和变更，再准许登录与重新出码。 |
| 负责人和运维 | 仅用合成试用账号验证旧登录被拒、旧码不能预览或消费；重新登录后权限正确，新码只能完成一次交接，家长能读到该条记录。登记恢复点、耗时、差异与处理人后，再将应用切换到核准的新库。 |

若不能核清恢复点之后的记录，保持维护并保留源库、备份与恢复库。单份逻辑备份无法还原其后的操作，需另取可信交接台账或由运维使用已配置的 WAL 时间点恢复。开放后如需切回，先停写并对账新库已接受的操作，避免直接切回引起第二次数据倒退。目标服务器的备份保管、保留周期、能容忍的数据缺口和恢复耗时需在该环境单独验收。
