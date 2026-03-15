const Database = require('better-sqlite3');

try {
  const db = new Database('./prisma/template.db', { readonly: true });
  
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));
  
  // Try to get users
  try {
    const users = db.prepare('SELECT * FROM User').all();
    console.log('\nUsers found:', users.length);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.log('No User table:', e.message);
  }
  
  // Try to get tenants
  try {
    const tenants = db.prepare('SELECT * FROM Tenant').all();
    console.log('\nTenants found:', tenants.length);
    console.log(JSON.stringify(tenants, null, 2));
  } catch (e) {
    console.log('No Tenant table:', e.message);
  }
  
  db.close();
} catch (e) {
  console.error('Error:', e.message);
}
