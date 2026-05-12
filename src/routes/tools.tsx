import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Wand2 } from "lucide-react";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools — Magic Studio" },
      { name: "description", content: "Advanced AI generation tools coming soon." },
    ],
  }),
  component: Tools,
});

function Tools() {
  return (
    <MobileFrame>
      <div className="min-h-[calc(100dvh-5rem)] flex flex-col items-center justify-center p-8 text-center">
        <div className="size-24 rounded-3xl bg-card border border-border grid place-items-center mb-6 relative">
          <div className="absolute inset-0 rounded-3xl bg-brand/20 blur-2xl" />
          <Wand2 className="size-10 text-brand relative" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Advanced Lab</h2>
        <p className="text-sm text-muted-foreground max-w-[28ch] mb-8">
          Our creative engine is preparing new generation tools for your content.
        </p>
        <button
          disabled
          className="w-full max-w-xs py-4 rounded-2xl bg-secondary text-muted-foreground font-medium text-sm border border-border"
        >
          Coming Soon
        </button>
      </div>
    </MobileFrame>
  );
}
