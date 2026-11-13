import { VisitorRouteView } from "../route-view";

export const dynamic = "force-dynamic";

export default function VisitorHomePage() {
  return <VisitorRouteView path="/web/visitor/home" section="home" />;
}
