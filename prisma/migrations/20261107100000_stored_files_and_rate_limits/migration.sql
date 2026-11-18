-- Hébergement sans serveur (2026-11-07) : fichiers envoyés en base et état
-- partagé entre instances (limites de débit, coupe-circuits) sans Redis.

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- Compteurs jetables : UNLOGGED = aucune écriture dans le journal (WAL), donc
-- des mises à jour bien plus rapides. Vidés après un arrêt brutal de
-- PostgreSQL, ce qui est sans conséquence (limites remises à zéro).

-- CreateTable
CREATE UNLOGGED TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE UNLOGGED TABLE "token_buckets" (
    "key" TEXT NOT NULL,
    "tokens" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storedFilename_key" ON "stored_files"("storedFilename");

-- CreateIndex
CREATE INDEX "stored_files_uploaderId_idx" ON "stored_files"("uploaderId");

-- CreateIndex
CREATE INDEX "stored_files_schoolId_idx" ON "stored_files"("schoolId");

-- CreateIndex
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");

-- CreateIndex
CREATE INDEX "token_buckets_updatedAt_idx" ON "token_buckets"("updatedAt");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Synchronisation des seaux à jetons, PAR LOT (un aller-retour pour toutes
-- les synchronisations simultanées d'un processus) : pour chaque seau,
-- inscrit la consommation accordée localement (`p_pending`, peut rendre le
-- seau négatif : c'est une dette, remboursée par le remplissage) et renvoie
-- son niveau. Verrous pris dans l'ordre des clés : deux lots concurrents ne
-- peuvent pas s'interbloquer. Horloge : celle du serveur PostgreSQL (UTC),
-- identique pour toutes les instances. `ord` = position dans l'appel.
CREATE OR REPLACE FUNCTION "edupilot_sync_token_buckets"(
    p_keys TEXT[],
    p_capacities DOUBLE PRECISION[],
    p_refill_per_ms DOUBLE PRECISION[],
    p_pending DOUBLE PRECISION[]
) RETURNS TABLE ("ord" INTEGER, "level" DOUBLE PRECISION)
LANGUAGE plpgsql AS $$
DECLARE
    v_now TIMESTAMP(3) := now() AT TIME ZONE 'UTC';
    v_item RECORD;
    v_level DOUBLE PRECISION;
BEGIN
    FOR v_item IN
        SELECT t.k, t.cap, t.rate, t.pend, t.i::INTEGER AS i
          FROM unnest(p_keys, p_capacities, p_refill_per_ms, p_pending) WITH ORDINALITY AS t(k, cap, rate, pend, i)
         ORDER BY t.k, t.i
    LOOP
        INSERT INTO "token_buckets" ("key", "tokens", "updatedAt")
        VALUES (v_item.k, v_item.cap, v_now)
        ON CONFLICT ("key") DO NOTHING;

        SELECT LEAST(v_item.cap, b."tokens" + GREATEST(0, EXTRACT(EPOCH FROM (v_now - b."updatedAt")) * 1000) * v_item.rate) - v_item.pend
          INTO v_level
          FROM "token_buckets" b
         WHERE b."key" = v_item.k
           FOR UPDATE;

        UPDATE "token_buckets" SET "tokens" = v_level, "updatedAt" = v_now WHERE "key" = v_item.k;
        "ord" := v_item.i;
        "level" := v_level;
        RETURN NEXT;
    END LOOP;
END;
$$;
