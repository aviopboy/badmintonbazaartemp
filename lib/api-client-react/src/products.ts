import { customFetch } from "./custom-fetch";

export type ApiProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAt?: number;
  description: string;
  image: string;
  tags: string[];
  featured: boolean;
  badge?: string;
  showcase?: string;
  availableSizes?: string[];
  availableSpeeds?: string[];
};

export async function listProducts(): Promise<ApiProduct[]> {
  return customFetch<ApiProduct[]>("/api/products", { method: "GET" });
}

export async function createProduct(product: ApiProduct): Promise<ApiProduct> {
  return customFetch<ApiProduct>("/api/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export async function updateProduct(id: string, product: ApiProduct): Promise<ApiProduct> {
  return customFetch<ApiProduct>(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await customFetch<void>(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
