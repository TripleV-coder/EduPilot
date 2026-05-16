import { t } from "@/lib/i18n";

/**
 * Swagger UI Page (Server Component)
 * Serves interactive API documentation. Spec available at /api/docs
 */
export default function SwaggerUIPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">{t("apiDocs.title")}</h1>
        <p className="text-gray-600 mb-8">
          {t("apiDocs.description")}
        </p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{t("apiDocs.access.title")}</h2>
          <div className="space-y-2">
            <p>
              <strong>{t("apiDocs.access.spec")}</strong>{" "}
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
              <strong>{t("apiDocs.access.format")}</strong>
            </p>
            <p>
              <strong>{t("apiDocs.access.tools")}</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <a 
                  href="https://editor.swagger.io/?url=/api/docs" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("apiDocs.access.swaggerEditor")}
                </a>
              </li>
              <li>
                <a 
                  href="https://www.postman.com/" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("apiDocs.access.postman")}
                </a>
              </li>
              <li>
                <a 
                  href="https://insomnia.rest/" 
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("apiDocs.access.insomnia")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t("apiDocs.auth.title")}</h2>
          <p className="mb-4">
            {t("apiDocs.auth.description")}
          </p>
            <div className="bg-white p-4 rounded border">
              <code className="text-sm">
                Authorization: Bearer &lt;token&gt;
              </code>
            </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("apiDocs.endpoints.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{t("apiDocs.endpoints.auth")}</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/auth/initial-setup</code></li>
                <li><code>POST /api/auth/initial-setup</code></li>
                <li><code>POST /api/auth/forgot-password</code></li>
                <li><code>POST /api/auth/reset-password</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{t("apiDocs.endpoints.students")}</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/students</code></li>
                <li><code>POST /api/students</code></li>
                <li><code>GET /api/students/:id</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{t("apiDocs.endpoints.teachers")}</h3>
              <ul className="text-sm space-y-1">
                <li><code>GET /api/teachers</code></li>
                <li><code>POST /api/teachers</code></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{t("apiDocs.endpoints.payments")}</h3>
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
