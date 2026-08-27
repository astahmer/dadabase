import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { WithDevtools } from "./-devtools.tsx";

interface MyRouterContext {
  queryClient: QueryClient;
}

/**
 * Blocking theme bootstrap — must run before first paint so the correct
 * theme class is on <html> immediately (no light flash on dark loads) and
 * native controls pick the right color-scheme. Mirrors src/hooks/use-theme.ts.
 */
const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var el=document.documentElement;if(d){el.classList.add("dark");}}catch(e){}})();`;

const RootErrorComponent = ({ error }: { error: unknown }) => {
  const technicalMessage = error instanceof Error ? error.message : String(error);
  return (
    <div className="bg-background text-foreground flex h-full min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Dadabase could not render this page. Reload and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
      >
        Reload Dadabase
      </button>
      {import.meta.env.DEV ? (
        <details className="text-muted-foreground max-w-xl text-xs">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{technicalMessage}</pre>
        </details>
      ) : null}
    </div>
  );
};

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Last-resort boundary: without this a render crash anywhere above the
  // route tree blanks the entire app (see ux-audit-2026-08-25 G1).
  errorComponent: RootErrorComponent,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "color-scheme",
        content: "dark light",
      },
      {
        title: "Dadabase",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "alternate icon",
        href: "/favicon.ico",
        sizes: "any",
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
        {/* {import.meta.env.DEV && (
					<script
						crossOrigin="anonymous"
						src="//unpkg.com/react-scan/dist/auto.global.js"
					></script>
				)} */}
      </head>
      <body className="bg-background text-foreground">
        <div className="flex h-full min-h-screen flex-col">{children}</div>
        <WithDevtools />
        <Scripts />
      </body>
    </html>
  );
}
