import { ContactFormBlock } from './contactFormBlock.js'
import { BlogIndexBlock }   from './blogIndexBlock.js'
import { ProductsGridBlock } from './productsGridBlock.js'
import { ProductCardBlock }  from './productCardBlock.js'
import { CartBlock }         from './cartBlock.js'
import { BookingFormBlock }  from './bookingFormBlock.js'

export const universalAtlasBlocks  = [ContactFormBlock, BlogIndexBlock]
export const ecommerceAtlasBlocks  = [ProductsGridBlock, ProductCardBlock, CartBlock]
export const bookingsAtlasBlocks   = [BookingFormBlock]

export function buildAtlasBlocks(siteType) {
  const blocks = [...universalAtlasBlocks]
  if (siteType === 'ecommerce') blocks.push(...ecommerceAtlasBlocks)
  if (siteType === 'bookings')  blocks.push(...bookingsAtlasBlocks)
  return blocks
}
