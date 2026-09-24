PRAGMA foreign_keys=OFF;

CREATE TABLE "new_FacebookAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerRef" TEXT NOT NULL DEFAULT 'local',
    "organizationId" TEXT,
    "brandId" TEXT,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerResourceId" TEXT,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacebookAccount_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacebookAccount_brandId_organizationId_fkey"
      FOREIGN KEY ("brandId", "organizationId") REFERENCES "Brand" ("id", "organizationId")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacebookAccount_providerResourceId_fkey"
      FOREIGN KEY ("providerResourceId") REFERENCES "ProviderResource" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_FacebookAccount" (
  "id","ownerRef","organizationId","brandId","pageId","pageName","accessToken","tokenExpiresAt","status","providerResourceId","linkedAt"
)
SELECT
  "id","ownerRef","organizationId","brandId","pageId","pageName","accessToken","tokenExpiresAt",'ACTIVE',NULL,"linkedAt"
FROM "FacebookAccount";

DROP TABLE "FacebookAccount";
ALTER TABLE "new_FacebookAccount" RENAME TO "FacebookAccount";

CREATE UNIQUE INDEX "FacebookAccount_ownerRef_pageId_key"
ON "FacebookAccount"("ownerRef", "pageId");

CREATE UNIQUE INDEX "FacebookAccount_brandId_pageId_key"
ON "FacebookAccount"("brandId", "pageId");

CREATE UNIQUE INDEX "FacebookAccount_providerResourceId_key"
ON "FacebookAccount"("providerResourceId");

CREATE INDEX "FacebookAccount_organizationId_brandId_idx"
ON "FacebookAccount"("organizationId", "brandId");

PRAGMA foreign_keys=ON;
