import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { FilesPanel } from "./files-panel";
import styles from "./files.module.css";

export const metadata: Metadata = { title: "文件与引用管理" };
export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<{ mode?: string }>;
}>;

export default async function FilesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const servicePort =
    process.env.TASK20_NEXT_ADMIN_SERVICE_PORT === "4319" ? 4319 : null;

  return (
    <AdminShell currentPath="/admin/files">
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>素材管理 · 本机合成数据</p>
          <h1>文件与引用管理</h1>
          <p>
            查看本校区素材的用途和状态，安全更换引用、归档或撤回。当前不上传、不下载，也不操作真实文件。
          </p>
        </header>
        {servicePort ? (
          <FilesPanel
            baseUrl={`http://127.0.0.1:${servicePort}`}
            readOnly={query.mode === "readonly"}
          />
        ) : (
          <section className={styles.stateCard} role="status">
            本机文件服务暂不可用；未显示任何素材记录。
          </section>
        )}
      </div>
    </AdminShell>
  );
}
