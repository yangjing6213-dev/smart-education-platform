import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminShell } from "../../admin-shell";
import { ADMIN_ROUTES } from "../../admin-routes";

type AdminRoutePageProps = Readonly<{ params: Promise<{ segments?: string[] }> }>;

async function resolveAdminRoute(params: AdminRoutePageProps["params"]) {
  const { segments = ["institution"] } = await params;
  const currentPath = `/admin/${segments.join("/")}`;
  const route = ADMIN_ROUTES.find(({ href }) => href === currentPath);
  return { currentPath, route };
}

export async function generateMetadata({ params }: AdminRoutePageProps): Promise<Metadata> {
  const { route } = await resolveAdminRoute(params);
  return { title: route?.label ?? "页面不存在" };
}

export default async function AdminRoutePage({ params }: AdminRoutePageProps) {
  const { currentPath, route } = await resolveAdminRoute(params);
  if (!route) notFound();

  return (
    <AdminShell currentPath={currentPath}>
      <section aria-labelledby="page-title" className="migration-notice">
        <p className="eyebrow">管理端迁移预览</p>
        <h1 id="page-title">{route.label}</h1>
        <p>
          本批已迁移工作台导航与页面布局。此业务页面尚未迁移，请继续使用现有管理端处理日常工作。
        </p>
        <span>仅用于本机架构验证 · 合成数据</span>
      </section>
    </AdminShell>
  );
}
