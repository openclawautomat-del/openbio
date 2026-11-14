import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin-tabs";

export const metadata = { title: { default: "Administration", template: "%s · Administration" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
