// Swagger UI for /api/openapi.json, which proxies presoft-api's own spec
// (see app/api/openapi.json/route.ts) — this documents the real API the
// dashboard calls, not a hand-maintained copy of it.
// Loaded from CDN rather than adding swagger-ui-react as a dependency —
// this is internal dev documentation, not shipped product UI.
export const metadata = { title: 'API Docs — Presoft Dashboard' }

export default function ApiDocsPage() {
  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <div id="swagger-ui" />
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function () {
              window.SwaggerUIBundle({
                url: '/api/openapi.json',
                dom_id: '#swagger-ui',
              })
            })
          `,
        }}
      />
    </>
  )
}
