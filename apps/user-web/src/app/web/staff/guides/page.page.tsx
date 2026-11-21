import type { Metadata } from "next";
import { StaffLibraryPanel } from "../library-panel";

export const metadata: Metadata = { title: "新员工指南" };

export default function StaffLibraryPage() {
  return <StaffLibraryPanel collection="guides" />;
}
