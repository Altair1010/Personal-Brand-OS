"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Group } from "@/lib/performance-engine/aggregate";

interface HookPerfTableProps {
  groups: Group[];
}

export function HookPerfTable({ groups }: HookPerfTableProps) {
  if (groups.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hiệu suất theo hook</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Hook</th>
              <th className="py-2 pr-2 font-medium">Số bài</th>
              <th className="py-2 pr-2 font-medium">Reach TB</th>
              <th className="py-2 font-medium">Tương tác TB</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.label} className="border-b last:border-0">
                <td className="py-2 pr-2 font-medium text-foreground">
                  {g.label}
                </td>
                <td className="py-2 pr-2">{g.count}</td>
                <td className="py-2 pr-2">{g.avgReach}</td>
                <td className="py-2">{g.avgEngagement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
