import { promises as fs } from "fs";
import path from "path";
import { Children, isValidElement, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  INFO_PAGE_LAST_UPDATED,
  INFO_PAGE_TITLE,
  isExternalInfoUrl,
} from "@/lib/info";
import { cn } from "@/lib/utils";

const infoContentPath = path.join(process.cwd(), "content", "overview.md");

type TocEntry = {
  title: string;
  slug: string;
  children: Array<{ title: string; slug: string }>;
};

export const metadata: Metadata = {
  title: `${INFO_PAGE_TITLE} | Personalized vocabulary acquisition`,
  description:
    "Learn how submission data is collected, transformed, excluded, and reviewed before it is included in the research dataset.",
};

function getNodeText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getNodeText(child.props.children);
      }

      return "";
    })
    .join("");
}

function slugifyHeading(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractMainSections(markdown: string) {
  const sections: TocEntry[] = [];
  let currentSection: TocEntry | null = null;

  for (const line of markdown.split("\n")) {
    const h2Match = line.match(/^##(?!#)\s+(.+)$/);
    if (h2Match) {
      const title = h2Match[1].trim();
      if (!title) {
        continue;
      }

      currentSection = {
        title,
        slug: slugifyHeading(title),
        children: [],
      };
      sections.push(currentSection);
      continue;
    }

    const h3Match = line.match(/^###(?!#)\s+(.+)$/);
    if (h3Match && currentSection) {
      const title = h3Match[1].trim();
      if (!title) {
        continue;
      }

      currentSection.children.push({
        title,
        slug: slugifyHeading(title),
      });
    }
  }

  return sections;
}

function renderTocEntries(entries: TocEntry[]) {
  return (
    <ol className="mt-3 space-y-2 pl-5 text-sm text-muted-foreground">
      {entries.map((entry) => (
        <li key={entry.slug} className="pl-1">
          <a
            href={`#${entry.slug}`}
            className="transition hover:text-foreground hover:underline"
          >
            {entry.title}
          </a>
          {entry.children.length > 0 ? (
            <ol className="mt-2 space-y-2 pl-5">
              {entry.children.map((child) => (
                <li key={child.slug} className="pl-1">
                  <a
                    href={`#${child.slug}`}
                    className="transition hover:text-foreground hover:underline"
                  >
                    {child.title}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const markdownComponents: Components = {
  h2: ({ node, className, children, ...props }) => (
    <h2
      id={slugifyHeading(getNodeText(children))}
      className={cn(
        "mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0",
        className,
      )}
      {...props}
    >
      <a
        href={`#${slugifyHeading(getNodeText(children))}`}
        className="group inline-flex items-center gap-2 text-foreground no-underline hover:text-primary focus-visible:text-primary focus-visible:outline-none"
        aria-label={`Link to section ${getNodeText(children)}`}
      >
        <span>{children}</span>
        <Link2 className="mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
      </a>
    </h2>
  ),
  h3: ({ node, className, children, ...props }) => (
    <h3
      id={slugifyHeading(getNodeText(children))}
      className={cn(
        "mt-8 scroll-mt-24 text-lg font-semibold tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ node, className, children, ...props }) => (
    <h4
      id={slugifyHeading(getNodeText(children))}
      className={cn(
        "mt-6 scroll-mt-24 text-base font-semibold tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </h4>
  ),
  p: ({ node, className, ...props }) => (
    <p
      className={cn("mt-4 leading-7 text-foreground/90 first:mt-0", className)}
      {...props}
    />
  ),
  ul: ({ node, className, ...props }) => (
    <ul className={cn("mt-4 list-disc space-y-2 pl-6", className)} {...props} />
  ),
  ol: ({ node, className, ...props }) => (
    <ol
      className={cn("mt-4 list-decimal space-y-2 pl-6", className)}
      {...props}
    />
  ),
  li: ({ node, className, ...props }) => (
    <li
      className={cn("pl-1 marker:text-foreground/70", className)}
      {...props}
    />
  ),
  a: ({ node, className, href, ...props }) => {
    const external = href ? isExternalInfoUrl(href) : false;

    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        className={cn(
          "font-medium text-foreground underline underline-offset-4 transition hover:text-primary",
          className,
        )}
        {...props}
      />
    );
  },
  strong: ({ node, className, ...props }) => (
    <strong
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  ),
  em: ({ node, className, ...props }) => (
    <em className={cn("italic", className)} {...props} />
  ),
  code: ({ node, className, ...props }) =>
    className ? (
      <code className={cn("font-mono text-sm", className)} {...props} />
    ) : (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        {...props}
      />
    ),
  pre: ({ node, className, ...props }) => (
    <pre
      className={cn(
        "mt-4 overflow-x-auto rounded-xl border border-border/80 bg-muted/35 p-4 text-sm leading-7",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ node, className, ...props }) => (
    <blockquote
      className={cn(
        "mt-4 border-l-2 border-border pl-4 italic text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  table: ({ node, className, ...props }) => (
    <div className="mt-6 overflow-x-auto">
      <table
        className={cn(
          "w-full min-w-[42rem] border-collapse text-left text-sm",
          className,
        )}
        {...props}
      />
    </div>
  ),
  thead: ({ node, className, ...props }) => (
    <thead
      className={cn("border-b border-border/80 bg-muted/30", className)}
      {...props}
    />
  ),
  tbody: ({ node, className, ...props }) => (
    <tbody
      className={cn("[&_tr:last-child]:border-b-0", className)}
      {...props}
    />
  ),
  tr: ({ node, className, ...props }) => (
    <tr
      className={cn("border-b border-border/70 align-top", className)}
      {...props}
    />
  ),
  th: ({ node, className, ...props }) => (
    <th
      className={cn(
        "px-3 py-2 text-sm font-semibold text-foreground first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node, className, ...props }) => (
    <td
      className={cn(
        "px-3 py-2 leading-6 text-foreground/90 first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ node, className, ...props }) => (
    <hr className={cn("mt-8 border-border/80", className)} {...props} />
  ),
};

async function loadInfoMarkdown() {
  return fs.readFile(infoContentPath, "utf8");
}

export default async function InfoPage() {
  const markdown = await loadInfoMarkdown();
  const tocEntries = extractMainSections(markdown);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-[14px] border border-border/80 bg-background p-6 shadow-sm sm:p-8">
        <div className="space-y-3">
          <div
            className={
              "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {INFO_PAGE_TITLE}
            </h1>
            <Button asChild>
              <Link href="/research">
                Go to survey
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated {INFO_PAGE_LAST_UPDATED}
          </p>
        </div>

        {tocEntries.length > 0 ? (
          <div className="mt-8 border-t border-border/80 pt-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Contents
            </h2>
            {renderTocEntries(tocEntries)}
          </div>
        ) : null}

        <div className="mt-8 border-t border-border/80 pt-8 text-sm sm:text-base">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {markdown}
          </ReactMarkdown>
        </div>

        <div className="mt-10 border-t border-border/80 pt-6">
          <Button asChild>
            <Link href="/research">
              Go to survey
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
