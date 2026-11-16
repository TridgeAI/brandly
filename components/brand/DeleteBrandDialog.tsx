"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

/** Deletes a brand together with its posts and automations, after confirmation. */
export function DeleteBrandDialog({ brandId, brandName }: { brandId: string; brandName: string }) {
  const router = useRouter();
  const { deleteBrand, posts, automationRules, brands } = useStore();
  const [open, setOpen] = useState(false);

  const postCount = posts.filter((p) => p.brandId === brandId).length;
  const ruleCount = automationRules.filter((r) => r.brandId === brandId).length;
  const others = brands.filter((b) => b.id !== brandId).length;

  const confirm = () => {
    deleteBrand(brandId);
    setOpen(false);
    // Another brand becomes active automatically; with none left, start over.
    router.push(others > 0 ? "/brand" : "/");
  };

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="danger">
          <Trash2 size={15} /> Delete brand
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-md rounded-2xl border border-border bg-card p-6 shadow-pop animate-fade-in focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">Delete {brandName}?</Dialog.Title>
          <Dialog.Description className="text-sm text-text-muted mt-2 leading-relaxed">
            This removes the brand profile
            {postCount || ruleCount
              ? `, ${[postCount ? plural(postCount, "post") : "", ruleCount ? plural(ruleCount, "automation") : ""].filter(Boolean).join(" and ")}`
              : ""}
            . You can&apos;t undo this.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" autoFocus>
                Cancel
              </Button>
            </Dialog.Close>
            <button
              onClick={confirm}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-error text-white hover:bg-error/90 transition-colors"
            >
              Delete brand
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
