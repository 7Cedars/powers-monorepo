import { redirect } from 'next/navigation'

export default async function OverviewIndexPage({
  params,
}: {
  params: Promise<{ chainId: string; powers: string }>
}) {
  const { chainId, powers } = await params
  redirect(`/overview/${chainId}/${powers}/organisation`)
}
