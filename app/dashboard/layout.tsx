import type { ReactNode } from "react";
import HelpBot from "@/components/HelpBot";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <HelpBot />
    </>
  );
}
