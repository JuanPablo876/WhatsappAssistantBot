-- CreateTable
CREATE TABLE "ServiceType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "price" REAL,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "workflowGuidance" TEXT NOT NULL DEFAULT '',
    "implementationNotes" TEXT NOT NULL DEFAULT '',
    "codeSnippets" TEXT NOT NULL DEFAULT '[]',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PROPOSED',
    "deliveryMode" TEXT NOT NULL DEFAULT 'KNOWLEDGE',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentSkill_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentSkill_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentSkillSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL DEFAULT 'web',
    "snippet" TEXT NOT NULL DEFAULT '',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentSkillSource_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "AgentSkill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAgentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "messages" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminAgentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAgentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL DEFAULT '',
    "outputSummary" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAgentAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminAgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminAgentAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderJob_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderJob_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deliveredAt" DATETIME,
    "errorDetail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReminderHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReminderJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "callId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "transcript" TEXT NOT NULL DEFAULT '[]',
    "latencyMs" TEXT NOT NULL DEFAULT '{}',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "CallSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "serviceTypeId" TEXT,
    "calendarEventId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("calendarEventId", "contactId", "createdAt", "description", "endTime", "id", "reminderSent", "startTime", "status", "tenantId", "title", "updatedAt") SELECT "calendarEventId", "contactId", "createdAt", "description", "endTime", "id", "reminderSent", "startTime", "status", "tenantId", "title", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");
CREATE INDEX "Appointment_contactId_idx" ON "Appointment"("contactId");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_startTime_idx" ON "Appointment"("startTime");
CREATE TABLE "new_BusinessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "businessType" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "services" TEXT,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "openTime" TEXT NOT NULL DEFAULT '09:00',
    "closeTime" TEXT NOT NULL DEFAULT '17:00',
    "workingDays" TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "language" TEXT NOT NULL DEFAULT 'en',
    "tone" TEXT NOT NULL DEFAULT 'friendly',
    "reminderMinutes" INTEGER NOT NULL DEFAULT 60,
    "welcomeMessage" TEXT NOT NULL DEFAULT '',
    "reminderLeadMinutes" TEXT NOT NULL DEFAULT '[60]',
    "reminderChannels" TEXT NOT NULL DEFAULT '["WHATSAPP"]',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "emailProvider" TEXT,
    "emailApiKey" TEXT,
    "emailFromAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessProfile" ("businessName", "businessType", "closeTime", "createdAt", "description", "id", "language", "maxAdvanceDays", "openTime", "promptVersion", "reminderMinutes", "services", "slotDuration", "systemPrompt", "tenantId", "timezone", "tone", "updatedAt", "welcomeMessage", "workingDays") SELECT "businessName", "businessType", "closeTime", "createdAt", "description", "id", "language", "maxAdvanceDays", "openTime", "promptVersion", "reminderMinutes", "services", "slotDuration", "systemPrompt", "tenantId", "timezone", "tone", "updatedAt", "welcomeMessage", "workingDays" FROM "BusinessProfile";
DROP TABLE "BusinessProfile";
ALTER TABLE "new_BusinessProfile" RENAME TO "BusinessProfile";
CREATE UNIQUE INDEX "BusinessProfile_tenantId_key" ON "BusinessProfile"("tenantId");
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "language" TEXT NOT NULL DEFAULT 'en',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "reminderOptOut" BOOLEAN NOT NULL DEFAULT false,
    "preferredChannel" TEXT,
    CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("createdAt", "email", "id", "language", "metadata", "name", "phone", "tenantId", "timezone", "updatedAt") SELECT "createdAt", "email", "id", "language", "metadata", "name", "phone", "tenantId", "timezone", "updatedAt" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");
CREATE UNIQUE INDEX "Contact_tenantId_phone_key" ON "Contact"("tenantId", "phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServiceType_tenantId_idx" ON "ServiceType"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSkill_category_idx" ON "AgentSkill"("category");

-- CreateIndex
CREATE INDEX "AgentSkill_reviewStatus_idx" ON "AgentSkill"("reviewStatus");

-- CreateIndex
CREATE INDEX "AgentSkill_isEnabled_idx" ON "AgentSkill"("isEnabled");

-- CreateIndex
CREATE INDEX "AgentSkill_lastUsedAt_idx" ON "AgentSkill"("lastUsedAt");

-- CreateIndex
CREATE INDEX "AgentSkill_priority_idx" ON "AgentSkill"("priority");

-- CreateIndex
CREATE INDEX "AgentSkillSource_skillId_idx" ON "AgentSkillSource"("skillId");

-- CreateIndex
CREATE INDEX "AgentSkillSource_contentHash_idx" ON "AgentSkillSource"("contentHash");

-- CreateIndex
CREATE INDEX "AdminAgentSession_userId_idx" ON "AdminAgentSession"("userId");

-- CreateIndex
CREATE INDEX "AdminAgentSession_createdAt_idx" ON "AdminAgentSession"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAgentAuditLog_sessionId_idx" ON "AdminAgentAuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "AdminAgentAuditLog_userId_idx" ON "AdminAgentAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AdminAgentAuditLog_toolName_idx" ON "AdminAgentAuditLog"("toolName");

-- CreateIndex
CREATE INDEX "AdminAgentAuditLog_createdAt_idx" ON "AdminAgentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReminderJob_tenantId_idx" ON "ReminderJob"("tenantId");

-- CreateIndex
CREATE INDEX "ReminderJob_status_scheduledFor_idx" ON "ReminderJob"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReminderJob_appointmentId_idx" ON "ReminderJob"("appointmentId");

-- CreateIndex
CREATE INDEX "ReminderHistory_jobId_idx" ON "ReminderHistory"("jobId");

-- CreateIndex
CREATE INDEX "CallSession_tenantId_idx" ON "CallSession"("tenantId");

-- CreateIndex
CREATE INDEX "CallSession_startedAt_idx" ON "CallSession"("startedAt");

-- CreateIndex
CREATE INDEX "TimeOff_tenantId_idx" ON "TimeOff"("tenantId");

-- CreateIndex
CREATE INDEX "TimeOff_startDate_endDate_idx" ON "TimeOff"("startDate", "endDate");
