import { redirect } from "next/navigation";
import { Suspense } from "react";
import { JobView } from "@/components/JobView";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Tu resultado" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getUser())) redirect(`/entrar`);
  return (
    <Suspense>
      <JobView id={id} />
    </Suspense>
  );
}
