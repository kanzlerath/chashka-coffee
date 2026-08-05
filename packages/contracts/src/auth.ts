import { z } from 'zod'

const displayNameSchema = z
  .union([z.string().trim().min(2).max(80), z.literal('')])
  .optional()
  .transform((value) => {
    if (value === '' || value === undefined) return undefined
    return value
  })

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const userRoleSchema = z.enum([
  'SUPER_ADMIN',
  'CONTENT_MANAGER',
  'CATALOG_MANAGER',
  'ORDER_OPERATOR',
  'LEAD_OPERATOR',
  'RECRUITER',
])
export type UserRole = z.infer<typeof userRoleSchema>

export const staffPermissionSchema = z.enum([
  'STAFF_MANAGE',
  'CONTENT_MANAGE',
  'CATALOG_MANAGE',
  'ORDERS_MANAGE',
  'LEADS_MANAGE',
  'JOBS_MANAGE',
  'JOB_APPLICATIONS_MANAGE',
  'MEDIA_MANAGE',
  'CUSTOMERS_READ',
  'CUSTOMERS_MANAGE',
  'ANALYTICS_READ',
  'AUDIT_READ',
])
export type StaffPermission = z.infer<typeof staffPermissionSchema>

export const rolePermissions: Readonly<Record<UserRole, readonly StaffPermission[]>> = {
  SUPER_ADMIN: staffPermissionSchema.options,
  CONTENT_MANAGER: ['CONTENT_MANAGE', 'MEDIA_MANAGE'],
  CATALOG_MANAGER: ['CATALOG_MANAGE', 'MEDIA_MANAGE'],
  ORDER_OPERATOR: ['ORDERS_MANAGE'],
  LEAD_OPERATOR: ['LEADS_MANAGE'],
  RECRUITER: ['JOBS_MANAGE', 'JOB_APPLICATIONS_MANAGE'],
}

export function hasPermission(
  user: { roles: readonly UserRole[] } | null | undefined,
  permission: StaffPermission,
) {
  return Boolean(user?.roles.some((role) => rolePermissions[role].includes(permission)))
}

const assignedRolesSchema = z.array(userRoleSchema).min(1).max(userRoleSchema.options.length)
  .refine((roles) => new Set(roles).size === roles.length, 'Roles must be unique')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')

export const userSchema = z.object({
  id: z.string(),
  email: emailSchema,
  displayName: z.string().nullable(),
  roles: assignedRolesSchema,
  createdAt: z.string().datetime(),
})

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
})

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const createStaffUserRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  roles: assignedRolesSchema.default(['CONTENT_MANAGER']),
})

export const updateStaffUserRequestSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(80).nullable(),
  roles: assignedRolesSchema,
  password: z.union([passwordSchema, z.literal('')]).optional().transform((value) => value || undefined),
})
export const staffUserListResponseSchema = z.object({ users: z.array(userSchema) })
export const staffUserResponseSchema = z.object({ user: userSchema })
export const staffUserDeleteResponseSchema = z.object({ deleted: z.literal(true) })

export const cookieRefreshRequestSchema = z.object({}).strict().optional().default({})
export const cookieLogoutRequestSchema = z.object({}).strict().optional().default({})

export const tokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(32),
})

export const tokenLogoutRequestSchema = tokenRefreshRequestSchema

export const cookieAuthResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
}).strict()

export const tokenAuthResponseSchema = cookieAuthResponseSchema.extend({
  refreshToken: z.string(),
})

export const cookieRefreshResponseSchema = z.object({
  accessToken: z.string(),
}).strict()

export const tokenRefreshResponseSchema = cookieRefreshResponseSchema.extend({
  refreshToken: z.string(),
})

export const meResponseSchema = z.object({
  user: userSchema,
})

export type UserDto = z.infer<typeof userSchema>
export type RegisterRequest = z.input<typeof registerRequestSchema>
export type RegisterPayload = z.output<typeof registerRequestSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type CreateStaffUserRequest = z.output<typeof createStaffUserRequestSchema>
export type UpdateStaffUserRequest = z.output<typeof updateStaffUserRequestSchema>
export type CookieRefreshRequest = z.infer<typeof cookieRefreshRequestSchema>
export type CookieLogoutRequest = z.infer<typeof cookieLogoutRequestSchema>
export type TokenRefreshRequest = z.infer<typeof tokenRefreshRequestSchema>
export type TokenLogoutRequest = z.infer<typeof tokenLogoutRequestSchema>
export type CookieAuthResponse = z.infer<typeof cookieAuthResponseSchema>
export type TokenAuthResponse = z.infer<typeof tokenAuthResponseSchema>
export type CookieRefreshResponse = z.infer<typeof cookieRefreshResponseSchema>
export type TokenRefreshResponse = z.infer<typeof tokenRefreshResponseSchema>
export type MeResponse = z.infer<typeof meResponseSchema>
