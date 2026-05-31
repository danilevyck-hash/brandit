import GuiaDetail from "@/components/guias/GuiaDetail";

export const dynamic = "force-dynamic";

export default function GuiaDetailPage({ params }: { params: { id: string } }) {
  return <GuiaDetail id={params.id} />;
}
