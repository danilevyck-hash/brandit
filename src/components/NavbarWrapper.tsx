"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import ClaudeChat from "./ClaudeChat";

export default function NavbarWrapper() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  // On home page, only show ClaudeChat — modules replace the navbar
  if (pathname === "/") return <ClaudeChat />;

  return (
    <>
      <Navbar />
      <ClaudeChat />
    </>
  );
}
