import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      data-piltover-page-context
      className={cn(
        "flex-1 overflow-y-auto bg-transparent",
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
