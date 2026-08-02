import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllProducts, getProductBySlug } from '@/lib/stripe-catalog';
import ProductDetail from '@/components/shop/ProductDetail';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}