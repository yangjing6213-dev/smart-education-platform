import type { Metadata } from "next";
import { StaffLibraryPanel } from "../library-panel";

export const metadata: Metadata = { title: "教学资源" };

export default function StaffLibraryPage() {
  return <StaffLibraryPanel collection="resources" />;
}
