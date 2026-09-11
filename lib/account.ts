import { z } from 'zod'

export const defaultProfileLocale = 'en-US' as const

export const profileLocaleOptions = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
] as const

const profileLocaleValues = profileLocaleOptions.map(({ value }) => value) as [
  string,
  ...string[],
]

export const profileLocaleSchema = z.enum(profileLocaleValues)

const displayNameSchema = z
  .string()
  .transform((value) =>
    value
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  .pipe(
    z
      .string()
      .min(1, 'Enter a display name.')
      .max(100, 'Display names must be 100 characters or fewer.'),
  )

export const updateProfileSchema = z
  .object({
    name: displayNameSchema.optional(),
    locale: profileLocaleSchema.optional(),
  })
  .strict()
  .refine(({ name, locale }) => name !== undefined || locale !== undefined, {
    message: 'Choose a profile field to update.',
  })

export type UpdateProfile = z.infer<typeof updateProfileSchema>

export type ProfileSummary = {
  id: string
  name: string
  email: string
  locale: string
}

export function toProfileSummary(user: {
  id: string
  name: string
  email: string
  locale?: string | null
}): ProfileSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    locale: profileLocaleSchema.safeParse(user.locale).success
      ? user.locale!
      : defaultProfileLocale,
  }
}
