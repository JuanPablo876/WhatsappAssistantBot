const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // List all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    });
    
    console.log('\n=== Available Tenants ===');
    tenants.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name} (ID: ${t.id})`);
    });
    
    // The number to add
    const phoneNumber = '+523321011949';
    const twilioSid = 'PN_MX_GDL_MAIN'; // You can update this with real Twilio SID later
    
    // Which tenant to assign? Change the index (0, 1, or 2) to select
    const assignToTenant = tenants[2]; // "andres barba"
    
    // Check if number already exists
    let existing = await prisma.platformPhoneNumber.findUnique({
      where: { phoneNumber },
    });
    
    if (existing) {
      console.log('\n=== Number Already Exists ===');
      console.log(`Phone: ${existing.phoneNumber}`);
      console.log(`Status: ${existing.status}`);
      console.log(`Tenant ID: ${existing.tenantId || 'Not assigned'}`);
    } else {
      // Add the number
      console.log('\n=== Adding Number ===');
      existing = await prisma.platformPhoneNumber.create({
        data: {
          phoneNumber,
          twilioSid,
          countryCode: 'MX',
          areaCode: '33',
          friendlyName: 'Guadalajara Main Line',
          monthlyPrice: 5.00,
          twilioCost: 1.15,
          voiceEnabled: true,
          smsEnabled: true,
          status: 'AVAILABLE',
        },
      });
      console.log(`✅ Added ${phoneNumber} to platform numbers`);
    }
    
    // Assign to tenant if specified
    if (assignToTenant && existing.status === 'AVAILABLE') {
      console.log(`\n=== Assigning to ${assignToTenant.name} ===`);
      
      // Update the platform number
      await prisma.platformPhoneNumber.update({
        where: { id: existing.id },
        data: {
          tenantId: assignToTenant.id,
          assignedAt: new Date(),
          status: 'ASSIGNED',
        },
      });
      
      // Update tenant's WhatsApp config
      await prisma.whatsappConfig.upsert({
        where: { tenantId: assignToTenant.id },
        create: {
          tenantId: assignToTenant.id,
          setupType: 'RENT_NUMBER',
          channel: 'CLOUD_API',
          platformPhoneNumberId: existing.id,
          isActive: true,
        },
        update: {
          setupType: 'RENT_NUMBER',
          platformPhoneNumberId: existing.id,
          isActive: true,
        },
      });
      
      console.log(`✅ Assigned ${phoneNumber} to tenant "${assignToTenant.name}"`);
      console.log(`✅ Updated WhatsApp config for tenant`);
    }
    
    // Final status
    const finalNumber = await prisma.platformPhoneNumber.findUnique({
      where: { phoneNumber },
    });
    console.log('\n=== Final Status ===');
    console.log(`Phone: ${finalNumber.phoneNumber}`);
    console.log(`Status: ${finalNumber.status}`);
    console.log(`Tenant ID: ${finalNumber.tenantId || 'Not assigned'}`);
    
  } finally {
    await prisma.$disconnect();
  }
}

main();
