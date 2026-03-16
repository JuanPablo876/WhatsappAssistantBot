const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

// Check tenants and their plans
const tenants = db.prepare("SELECT id, name, plan, onboardingComplete, userId FROM Tenant").all();
console.log('=== TENANTS ===');
tenants.forEach(t => {
  console.log(`  id=${t.id} name=${t.name} plan=${t.plan} onboarding=${t.onboardingComplete} userId=${t.userId}`);
});

// Check voice configs
const voiceConfigs = db.prepare("SELECT * FROM VoiceConfig").all();
console.log('\n=== VOICE CONFIGS ===');
console.log(JSON.stringify(voiceConfigs, null, 2));

// Check users
const users = db.prepare("SELECT id, name, email, role FROM User").all();
console.log('\n=== USERS ===');
users.forEach(u => console.log(`  id=${u.id} name=${u.name} email=${u.email} role=${u.role}`));

// Check tenant-user relationship
const tenantUsers = db.prepare("SELECT * FROM _TenantUsers").all();
console.log('\n=== TENANT-USERS ===');
tenantUsers.forEach(tu => console.log(`  A=${tu.A} B=${tu.B}`));

db.close();
