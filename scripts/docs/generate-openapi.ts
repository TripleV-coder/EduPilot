/**
 * Écrit `docs/openapi.json` depuis le code (voir `build-openapi.ts`).
 *   npm run docs:openapi
 */
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildOpenApiDocument } from "./build-openapi";

const ROOT = path.resolve(__dirname, "../..");
const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version as string;

buildOpenApiDocument(version)
    .then((document) => {
        const target = path.join(ROOT, "docs/openapi.json");
        writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
        const paths = Object.keys(document.paths).length;
        const operations = Object.values(document.paths).reduce(
            (sum, item) => sum + Object.keys(item).filter((key) => key !== "parameters").length,
            0,
        );
        const schemas = Object.keys(document.components.schemas).length;
        console.log(`docs/openapi.json — ${paths} chemins, ${operations} opérations, ${schemas} schémas.`);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
