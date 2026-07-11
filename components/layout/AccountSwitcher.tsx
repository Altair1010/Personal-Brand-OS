"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listFacebookAccounts,
  type FacebookAccountDTO,
} from "@/app/(dashboard)/performance/actions";
import { useFacebookStore } from "@/lib/stores/facebook";

// Client island in the Topbar: lets the user scope the dashboard to one linked Facebook
// Page. On change it updates the Zustand store (UI state) AND the URL ?fb= so server
// components (e.g. /performance) can filter reads. "Tất cả trang" (null) clears the filter.
export function AccountSwitcher() {
  const router = useRouter();
  const activeId = useFacebookStore((s) => s.activeFacebookAccountId);
  const setActive = useFacebookStore((s) => s.setActiveFacebookAccount);
  const [accounts, setAccounts] = useState<FacebookAccountDTO[]>([]);

  useEffect(() => {
    let active = true;
    listFacebookAccounts()
      .then((list) => {
        if (active) setAccounts(list);
      })
      .catch(() => {
        /* no accounts / unconfigured — switcher stays empty */
      });
    return () => {
      active = false;
    };
  }, []);

  if (accounts.length === 0) return null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value || null;
    setActive(id);
    if (id) {
      router.push(`/performance?fb=${encodeURIComponent(id)}`);
    } else {
      router.push("/performance");
    }
  }

  return (
    <select
      value={activeId ?? ""}
      onChange={onChange}
      className="h-8 rounded-md border bg-white px-2 text-xs text-foreground"
      title="Chọn trang Facebook"
    >
      <option value="">Tất cả trang</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.pageName}
        </option>
      ))}
    </select>
  );
}
