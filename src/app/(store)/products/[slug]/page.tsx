import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllProducts, getProductBySlug } from '@/lib/stripe-catalog';
import { isFlowersEnabled } from '@/lib/flagship-flag';
import JsonLd from '@/components/JsonLd';
import { productSchema, breadcrumbSchema } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
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
  const ogImage = {
    url: product.images[0],
    alt: product.name,
  };
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description,
      url: `/products/${product.slug}`,
      type: 'website',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description,
      images: [ogImage.url],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  if (product.category === "flower" && !isFlowersEnabled()) notFound();
  return (
    <>
      <JsonLd data={productSchema(product)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          {
            name: product.category === 'flower' ? 'Flowers' : 'Bouquets',
            url: `${SITE_URL}/${product.category}s`,
          },
          { name: product.name, url: `${SITE_URL}/products/${product.slug}` },
        ])}
      />
      <ProductDetail product={product} />
    </>
  );
}