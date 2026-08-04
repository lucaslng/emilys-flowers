import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'price', 'inStock'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'textarea', required: true },
    // price in integer cents (Stripe convention): 2499 = $24.99
    { name: 'price', type: 'number', required: true, min: 0 },
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Flower', value: 'flower' },
        { label: 'Bouquet', value: 'bouquet' },
      ],
    },
    { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'featuredOrder', type: 'number' },
    { name: 'inStock', type: 'checkbox', defaultValue: true },
    { name: 'flowerType', type: 'text' },
    { name: 'color', type: 'text' },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
    },
  ],
}
