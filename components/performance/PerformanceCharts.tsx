"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AggregateResult,
  Group,
} from "@/lib/performance-engine/aggregate";

interface PerformanceChartsProps {
  aggregates: AggregateResult;
}

function DimChart({ title, groups }: { title: string; groups: Group[] }) {
  if (groups.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={groups}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="avgReach" name="Reach TB" fill="#2563eb" />
            <Bar dataKey="avgEngagement" name="Tương tác TB" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PerformanceCharts({ aggregates }: PerformanceChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DimChart title="Theo pillar" groups={aggregates.byPillar} />
      <DimChart title="Theo hook" groups={aggregates.byHook} />
      <DimChart title="Theo CTA" groups={aggregates.byCta} />
      <DimChart title="Theo format" groups={aggregates.byFormat} />
    </div>
  );
}
