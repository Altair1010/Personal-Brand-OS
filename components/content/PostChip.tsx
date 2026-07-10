import { Badge } from "@/components/ui/badge";
import type { CalendarPostDTO } from "@/app/(dashboard)/studio/actions";

interface PostChipProps {
  post: CalendarPostDTO | null;
}

// Shows a status chip if the day has a Post, otherwise an empty placeholder.
export function PostChip({ post }: PostChipProps) {
  if (!post) {
    return (
      <span className="text-[10px] text-muted-foreground/60">chưa có bài</span>
    );
  }
  return (
    <Badge variant="default" className="text-[10px]">
      {post.status}
    </Badge>
  );
}
