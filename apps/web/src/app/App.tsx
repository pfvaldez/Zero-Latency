import { CORE_PACKAGE } from "@asknoor/core";
import { MotionConfig } from "motion/react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/animate-ui/components/radix/sheet";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";

// PHASE 0 PLACEHOLDER: a tooling check, not the product. Phase 4 replaces this screen.
export function App() {
  return (
    // Animate UI's accessibility advice: honour the guest's reduced-motion setting everywhere.
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 p-6">
        <p className="w-fit rounded-md border border-input bg-card px-2 py-1 text-sm font-bold">
          PLACEHOLDER: Phase 0 tooling check. Replaced in Phase 4.
        </p>
        <h1 className="text-3xl font-bold">Ask Noor</h1>
        <p>
          Shared package linked: <code>{CORE_PACKAGE}</code>
        </p>

        <Tabs defaultValue="story">
          <TabsList>
            <TabsTrigger value="story">Story</TabsTrigger>
            <TabsTrigger value="ask">Ask</TabsTrigger>
          </TabsList>
          <TabsContents>
            <TabsContent value="story">Story tab (placeholder).</TabsContent>
            <TabsContent value="ask">Ask tab (placeholder).</TabsContent>
          </TabsContents>
        </Tabs>

        <Sheet>
          <SheetTrigger asChild>
            <Button className="w-fit">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Placeholder sheet</SheetTitle>
              <SheetDescription>Replaced by the order sheet in Phase 4.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </main>
    </MotionConfig>
  );
}
