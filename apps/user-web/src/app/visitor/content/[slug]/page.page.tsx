import { VisitorRouteView } from "../../../web/visitor/route-view";

export const dynamic = "force-dynamic";

export default async function VisitorContentPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  return <VisitorRouteView path={`/visitor/content/${slug}`} section="home" />;
}
