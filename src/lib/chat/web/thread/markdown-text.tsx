"use client";

import {
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "../cn.ts";
import { isSafeMarkdownHref, shouldRenderMarkdownImage } from "./markdown-url-policy.ts";

const ReferenceMessageContext = createContext<((messageId: string) => void) | undefined>(undefined);

const MarkdownLink: NonNullable<Components["a"]> = ({ children, href, ...props }) => {
  const onReferenceMessage = useContext(ReferenceMessageContext);
  if (href?.startsWith("message:") === true) {
    const messageId = href.slice("message:".length);
    return (
      <button
        type="button"
        onClick={() => onReferenceMessage?.(messageId)}
        className="bg-muted text-foreground hover:bg-accent inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      >
        {children}
      </button>
    );
  }
  if (!isSafeMarkdownHref(href)) {
    return <span className="text-muted-foreground">{children}</span>;
  }
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4"
    >
      {children}
    </a>
  );
};

const MarkdownImage: NonNullable<Components["img"]> = ({ src, alt }) => {
  if (!shouldRenderMarkdownImage(src)) {
    return (
      <span className="text-muted-foreground text-sm">
        {alt !== undefined && alt !== "" ? `[image: ${alt}]` : "[image blocked]"}
      </span>
    );
  }
  return <img src={src} alt={alt ?? ""} className="my-3 max-h-96 max-w-full rounded-lg border" />;
};

/** Collapse threshold for fenced code blocks (audit M3). */
const CODE_COLLAPSE_LINES = 24;

/** Recursively collect text content out of a React node tree (audit M2). */
const nodeText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return nodeText(props.children);
  }
  return "";
};

/** Pull the `language-x` class rehype-highlight leaves on the fence's code element. */
const codeLanguage = (children: ReactNode): string | undefined => {
  const stack: Array<ReactNode> = [children];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (isValidElement(node)) {
      const className = (node.props as { className?: unknown }).className;
      if (typeof className === "string") {
        const match = /language-([\w+-]+)/.exec(className);
        if (match !== null) return match[1];
      }
      stack.push((node.props as { children?: ReactNode }).children);
    }
  }
  return undefined;
};

const LANGUAGE_LABELS: Record<string, string> = {
  sql: "SQL",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  bash: "Shell",
  shell: "Shell",
  html: "HTML",
  css: "CSS",
  md: "Markdown",
  markdown: "Markdown",
  python: "Python",
  py: "Python",
};

const languageLabel = (language: string | undefined): string | undefined => {
  if (language === undefined || language === "") return undefined;
  return LANGUAGE_LABELS[language] ?? language.toUpperCase();
};

/**
 * Fenced code block with header (audit M1 language label, audit M2 copy) and
 * collapse for tall blocks (audit M3). Highlighting itself is applied by
 * rehype-highlight; token colors come from styles.css `.hljs-*` rules.
 */
const CodeBlock = ({ children }: { children?: ReactNode }): ReactNode => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // remark keeps the fence's trailing newline in the code text — drop it so
  // copied SQL pastes cleanly (audit M2).
  const text = nodeText(children).replace(/\n+$/, "");
  const lineCount = text === "" ? 0 : text.split("\n").length;
  const collapsible = lineCount > CODE_COLLAPSE_LINES;
  const label = languageLabel(codeLanguage(children));

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions/HTTP); silently ignore — the button
      // simply doesn't confirm.
    }
  };

  return (
    <div
      className="bg-muted/50 my-3 overflow-hidden rounded-lg border"
      data-testid="chat-code-block"
    >
      <div className="bg-muted/60 text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-[11px] font-medium">
        <span data-testid="code-language">{label ?? "CODE"}</span>
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy code"}
          title="Copy code"
          data-testid="code-copy"
          onClick={() => void copy()}
          className="ms-auto cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className={cn(collapsible && !expanded && "relative max-h-64 overflow-hidden")}>
        <pre className="overflow-x-auto p-3 text-sm leading-6">{children}</pre>
        {collapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          data-testid="code-expand"
          onClick={() => setExpanded((value) => !value)}
          className="text-muted-foreground w-full cursor-pointer border-t px-3 py-1.5 text-[11px] font-medium hover:bg-accent"
        >
          {expanded ? "Collapse" : `Expand (${lineCount} lines)`}
        </button>
      )}
    </div>
  );
};

const markdownComponents: Components = {
  a: MarkdownLink,
  img: MarkdownImage,
  code: ({ className, children, ...props }) => {
    // Fenced blocks (marked hljs/language-* by rehype-highlight) are styled by
    // CodeBlock's pre scope; only inline code keeps the pill treatment.
    const isBlock =
      typeof className === "string" &&
      (className.includes("language-") || className.includes("hljs"));
    return (
      <code
        {...props}
        className={cn(
          "font-mono text-[0.9em]",
          isBlock ? "bg-transparent p-0" : "bg-muted rounded px-1 py-0.5",
          className,
        )}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-muted border px-2 py-1 text-left">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
  h1: ({ children }) => <h1 className="mt-6 mb-2 text-xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-5 mb-2 text-lg font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-primary/30 text-muted-foreground my-4 border-l-2 pl-4">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  hr: () => <hr className="border-border/70 my-5" />,
};

export const MarkdownText = ({
  text,
  onReferenceMessage,
}: {
  text: string;
  onReferenceMessage?: (messageId: string) => void;
}): ReactNode => (
  <div className="text-foreground/95 max-w-3xl text-[15px] leading-7">
    <ReferenceMessageContext.Provider value={onReferenceMessage}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {text.replace(
          /<message\s+id=["']([^"']+)["']\s*\/?\s*>/g,
          (_match, messageId: string) => `[Referenced message](message:${messageId})`,
        )}
      </ReactMarkdown>
    </ReferenceMessageContext.Provider>
  </div>
);
