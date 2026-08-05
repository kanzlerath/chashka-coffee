import 'dotenv/config'

import { customerPhoneSchema } from '@chashka-coffee/contracts'

import { createPrisma } from '../src/db'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required.')

const db = createPrisma(databaseUrl)

try {
  const orders = await db.order.findMany({
    where: { crmCustomerId: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
    },
  })

  for (const order of orders) {
    await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: order.customerPhone },
        create: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail },
        update: {
          name: order.customerName,
          ...(order.customerEmail ? { email: order.customerEmail } : {}),
        },
      })
      await tx.order.update({ where: { id: order.id }, data: { crmCustomerId: customer.id } })
      if (order.customerId) {
        await tx.customerAccount.updateMany({ where: { id: order.customerId }, data: { crmCustomerId: customer.id } })
      }
    })
  }

  const customers = await db.customer.findMany({ select: { id: true, phone: true } })
  const customerByPhone = new Map(customers.map((customer) => [customer.phone, customer.id]))
  const leads = await db.lead.findMany({ where: { crmCustomerId: null, phone: { not: null } }, select: { id: true, phone: true } })
  let linkedLeads = 0
  for (const lead of leads) {
    const parsed = customerPhoneSchema.safeParse(lead.phone)
    if (!parsed.success) continue
    const customerId = customerByPhone.get(parsed.data)
    if (!customerId) continue
    await db.lead.update({ where: { id: lead.id }, data: { crmCustomerId: customerId } })
    linkedLeads += 1
  }

  console.log(`CRM backfill complete: ${orders.length} orders, ${linkedLeads} leads linked.`)
} finally {
  await db.$disconnect()
}
