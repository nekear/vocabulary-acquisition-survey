import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface QuestionCardProps {
  children: ReactNode;
  className?: string;
}

export function QuestionCard({ children, className }: QuestionCardProps) {
  return <section className={cn("survey-card", className)}>{children}</section>;
}
