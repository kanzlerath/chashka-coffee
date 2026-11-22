import { expect, test } from 'bun:test'

import { resolveSeoMetadata } from '../src/lib/seo-metadata'

test('overrides only filled SEO fields and keeps page defaults', () => {
  expect(resolveSeoMetadata({ title: 'О компании', description: 'История', image: '/default.jpg' }, {
    title: 'Наша история', description: null, seoImageUrl: null,
  })).toEqual({
    title: 'Наша история', description: 'История', shareTitle: 'Наша история',
    shareDescription: 'История', image: '/default.jpg',
  })
})

test('uses existing metadata when there is no override', () => {
  expect(resolveSeoMetadata({ title: 'Кофе', description: 'Свой кофе', image: '/coffee.jpg' }, null)).toEqual({
    title: 'Кофе', description: 'Свой кофе', shareTitle: 'Кофе', shareDescription: 'Свой кофе', image: '/coffee.jpg',
  })
})
