"use client";

import { CornerLeftUpIcon, ListIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/styled/internal/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/styled/internal/ui/sheet.tsx";
import { cn } from "../cn.ts";
import { ChatThreadScroll } from "./chat-thread-scroll.ts";

export type MessageRailItem = {
  id: string;
  text: string;
  createdAt?: string;
};

export const formatMessageRailTime = ({ createdAt }: { createdAt: string }): string =>
  new Date(createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const MessageRailPreviewBody = ({ message }: { message: MessageRailItem }) => (
  <>
    <span className="block">{ChatThreadScroll.preview({ text: message.text })}</span>
    {message.createdAt !== undefined && (
      <span className="text-muted-foreground mt-1 block text-[0.7rem]">
        <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>
          {formatMessageRailTime({ createdAt: message.createdAt })}
        </time>
      </span>
    )}
  </>
);

export const MessageRail = ({
  messages,
  onSelect,
  canScrollToPreviousUserMessage,
  onScrollToPreviousUserMessage,
}: {
  messages: MessageRailItem[];
  onSelect: (messageId: string) => void;
  canScrollToPreviousUserMessage: boolean;
  onScrollToPreviousUserMessage: () => void;
}) => {
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (messages.length === 0) return null;

  const hoveredMessage = messages.find((message) => message.id === hoveredMessageId);
  const selectMessage = (messageId: string) => {
    onSelect(messageId);
    setSheetOpen(false);
  };

  return (
    <>
      <nav
        aria-label="User messages"
        data-testid="message-rail"
        className="pointer-events-none absolute inset-y-3 left-1 z-10 flex w-10 flex-col sm:left-2"
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        <div className="pointer-events-auto hidden min-h-0 flex-1 flex-col items-start justify-center gap-1.5 overflow-y-auto py-2 md:flex">
          {messages.map((message) => {
            const isHovered = hoveredMessageId === message.id;
            return (
              <button
                key={message.id}
                type="button"
                data-testid="message-rail-item"
                data-message-id={message.id}
                aria-label={`Jump to message: ${ChatThreadScroll.preview({ text: message.text, maxLength: 80 })}`}
                className={cn(
                  "bg-foreground/35 relative h-0.5 rounded-full transition-[width,background-color,opacity] duration-150",
                  "before:absolute before:-inset-y-1.5 before:left-0 before:w-7 before:content-['']",
                  "hover:bg-foreground/70 focus-visible:bg-foreground/70 focus-visible:outline-none",
                  isHovered ? "bg-foreground/80 w-7" : "w-3",
                )}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onFocus={() => setHoveredMessageId(message.id)}
                onBlur={() => setHoveredMessageId(null)}
                onClick={() => selectMessage(message.id)}
              />
            );
          })}
        </div>
        {hoveredMessage !== undefined && (
          <div
            role="tooltip"
            data-testid="message-rail-preview"
            className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-10 z-20 hidden w-56 -translate-y-1/2 rounded-md border px-3 py-2 text-xs shadow-md sm:left-12 sm:w-64 md:block"
          >
            <MessageRailPreviewBody message={hoveredMessage} />
          </div>
        )}
        <div className="pointer-events-auto mt-auto flex flex-col gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            title="Your messages"
            aria-label="Your messages"
            type="button"
            data-testid="message-rail-sheet-trigger"
            className="bg-background/95 rounded-full shadow-sm md:hidden"
            onClick={() => setSheetOpen(true)}
          >
            <ListIcon />
          </Button>
          {canScrollToPreviousUserMessage && (
            <Button
              variant="outline"
              size="icon-sm"
              title="Previous message"
              aria-label="Previous message"
              type="button"
              data-testid="scroll-to-previous-user-message"
              className="bg-background/95 rounded-full shadow-sm"
              onClick={onScrollToPreviousUserMessage}
            >
              <CornerLeftUpIcon />
            </Button>
          )}
        </div>
      </nav>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] gap-0 rounded-t-xl p-0"
          data-testid="message-rail-sheet"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>Your messages</SheetTitle>
            <SheetDescription className="sr-only">
              Jump to a previous message you sent
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                data-testid="message-rail-sheet-item"
                data-message-id={message.id}
                className="hover:bg-muted focus-visible:bg-muted flex min-h-11 w-full flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-left text-sm focus-visible:outline-none"
                onClick={() => selectMessage(message.id)}
              >
                <MessageRailPreviewBody message={message} />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
