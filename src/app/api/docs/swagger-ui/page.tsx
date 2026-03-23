/**
 * Swagger UI Page (Server Component)
 * Serves interactive API documentation. Spec available at /api/docs
 */
export default function SwaggerUIPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">EduPilot API Documentation</h1>
        <p className="text-gray-600 mb-8">
          Documentation interactive de l&apos;API EduPilot. Utilisez cette interface pour explorer et tester les endpoints.
        </p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Accès à la Documentation</h2>
          <div className="space-y-2">
            <p>
              <strong>Spécification OpenAPI JSON:</strong>{" "}
              <a 
                href="/api/docs" 
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                /api/docs
              </a>
            </p>
            <p>
              <strong>Format:</strong> OpenAPI 3.0.0
            </p>
            <p>
              <strong>Outils recommandés:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <a 
                  href="https://editor.swagger.io/?url=/api/docs" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Swagger Editor (en ligne)
                </a>
              </li>
              <li>
                <a 
                  href="https://www.postman.com/" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Postman (import depuis /api/docs)
                </a>
              </li>
              <li>
                <a 
                  href="https://insomnia.rest/" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Insomnia (import depuis /api/docs)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Authentification</h2>
          <p className="mb-4">
            La plupart des endpoints nécessitent une authentification. Utilisez le cookie de session NextAuth ou un token Bearer JWT.
          </p>
            <div className="bg-white p-4 rounded border">
              <code className="text-sm">
                Authorization: Bearer &lt;token&gt;
              </code>
            </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Endpoints Principaux</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Authentification</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/auth/initial-setup</code></li>
                <li><code>POST /api/auth/initial-setup</code></li>
                <li><code>POST /api/auth/forgot-password</code></li>
                <li><code>POST /api/auth/reset-password</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Élèves</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/students</code></li>
                <li><code>POST /api/students</code></li>
                <li><code>GET /api/students/:id</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Enseignants</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/teachers</code></li>
                <li><code>POST /api/teachers</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Paiements</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/payments</code></li>
                <li><code>POST /api/payments</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
