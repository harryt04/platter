export async function GET() {
  return new Response(
    'Serwist route reserved for the production service worker.',
    { status: 404 },
  )
}
