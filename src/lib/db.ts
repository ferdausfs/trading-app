import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * SQLite ফাইলের parent directory আগেই তৈরি করি।
 * Render/Vercel-এর মতো হোস্টে db/ ফোল্ডার না থাকলে Prisma
 * "unable to open database file" error দেয়।
 *
 * নোট: DATABASE_URL-এর file: পাথ schema.prisma-এর relative হলে
 * <root>/prisma/... হিসেবে resolve হয় — তাই দুটো বেসই কভার করি।
 */
function ensureSqliteDir() {
  try {
    const url = process.env.DATABASE_URL ?? ''
    if (!url.startsWith('file:')) return
    const raw = url.slice('file:'.length)
    if (!raw || raw === ':memory:') return
    const bases = raw.startsWith('/')
      ? [null]
      : [process.cwd(), resolve(process.cwd(), 'prisma')]
    for (const base of bases) {
      const abs = base ? resolve(base, raw) : raw
      mkdirSync(dirname(abs), { recursive: true })
    }
  } catch {
    // নিরাপদে পাস — আসল সমস্যা হলে Prisma নিজেই স্পষ্ট error দেখাবে
  }
}

ensureSqliteDir()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db