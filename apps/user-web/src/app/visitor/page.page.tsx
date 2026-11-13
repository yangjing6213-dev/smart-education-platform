import { VisitorRouteView } from "../web/visitor/route-view";

export const dynamic = "force-dynamic";

export default function VisitorPage() {
  return <VisitorRouteView path="/visitor" section="home" />;
}
