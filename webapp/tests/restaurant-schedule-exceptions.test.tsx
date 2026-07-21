import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ScheduleExceptions } from '../src/features/catalog-admin/RestaurantsPage'

describe('restaurant schedule exceptions', () => {
  test('does not participate in the parent restaurant form validation', () => {
    const markup = renderToStaticMarkup(
      <ScheduleExceptions
        draft={{ date: '2026-12-31', label: '', opensAt: '08:00', closesAt: '22:00', isClosed: false }}
        error={false}
        exceptions={[]}
        loading={false}
        saving={false}
        onChange={() => undefined}
        onDelete={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(markup).not.toContain(' required=""')
  })
})
