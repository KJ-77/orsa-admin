"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Pencil, Trash2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ProductImage {
  id: number;
  image_url: string;
  image_key: string;
  display_order: number;
  is_primary: boolean;
}

interface Product {
  id: number;
  name: string;
  price: string;
  quantity: number;
  description: string;
  images?: ProductImage[];
  primaryImage?: string;
}

const ProductsPage = () => {
  console.log("ProductsPage component rendering...");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Debug log whenever products state changes
  console.log("Current products state:", products);
  console.log("Products length:", products.length);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    quantity: 0,
    description: "",
  });
  const [submitting, setSubmitting] = useState(false); // Fetch products with images
  const fetchProducts = async () => {
    try {
      console.log("Starting to fetch products...");
      setLoading(true);
      const response = await fetch(
        "https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com/products"
      );
      console.log("Response received:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Data received:", data);

      // Handle different possible response structures
      let productsArray: Product[] = [];

      if (Array.isArray(data)) {
        productsArray = data;
        console.log("Data is directly an array");
      } else if (data.value && Array.isArray(data.value)) {
        productsArray = data.value;
        console.log("Data has 'value' property with array");
      } else if (data.products && Array.isArray(data.products)) {
        productsArray = data.products;
        console.log("Data has 'products' property with array");
      } else {
        console.log("Unknown data structure, setting empty array");
        productsArray = [];
      }

      // Fetch images for each product
      const productsWithImages = await Promise.all(
        productsArray.map(async (product) => {
          try {
            const imageResponse = await fetch(
              `https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com/products/${product.id}/images`
            );

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              const images = Array.isArray(imageData)
                ? imageData
                : imageData.images || [];
              const primaryImage =
                images.find((img: ProductImage) => img.is_primary)?.image_url ||
                images[0]?.image_url ||
                null;

              return {
                ...product,
                images,
                primaryImage,
              };
            } else {
              console.log(`No images found for product ${product.id}`);
              return {
                ...product,
                images: [],
                primaryImage: null,
              };
            }
          } catch (imageError) {
            console.error(
              `Error fetching images for product ${product.id}:`,
              imageError
            );
            return {
              ...product,
              images: [],
              primaryImage: null,
            };
          }
        })
      );

      console.log("Final productsArray with images:", productsWithImages);
      setProducts(productsWithImages);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  // Delete product
  const handleDelete = async (product: Product) => {
    try {
      setSubmitting(true);
      const response = await fetch(
        `https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com/products/${product.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Remove from local state
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success("Product deleted successfully");
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    } finally {
      setSubmitting(false);
    }
  };

  // Update product
  const handleUpdate = async () => {
    if (!productToEdit) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com/products/${productToEdit.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editForm.name,
            price: editForm.price,
            quantity: editForm.quantity,
            description: editForm.description,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.id === productToEdit.id ? { ...p, ...editForm } : p))
      );

      toast.success("Product updated successfully");
      setEditDialogOpen(false);
      setProductToEdit(null);
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (product: Product) => {
    setProductToEdit(product);
    setEditForm({
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      description: product.description,
    });
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };
  useEffect(() => {
    console.log("useEffect running, calling fetchProducts...");
    fetchProducts();
  }, []); // Empty dependency array - only run once on mount

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading products...</span>
      </div>
    );
  }

  console.log(
    "About to render. Products:",
    products,
    "Length:",
    products.length,
    "Loading:",
    loading
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Button onClick={fetchProducts} variant="outline">
          Refresh
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="relative group overflow-hidden">
              {/* Product Image */}
              <div className="aspect-square relative bg-gray-100 overflow-hidden">
                {product.primaryImage ? (
                  <img
                    src={product.primaryImage}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}

                {/* Action Menu */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(product)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(product)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Image Count Badge */}
                {product.images && product.images.length > 1 && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    +{product.images.length - 1} more
                  </div>
                )}
              </div>

              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">
                      {product.name}
                    </CardTitle>
                    <CardDescription className="text-2xl font-bold text-green-600 mt-1">
                      ${product.price}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">{product.quantity}</span>
                  </div>
                  {product.description && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Description:
                      </span>
                      <p className="text-sm mt-1 line-clamp-2">
                        {product.description}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>{" "}
            <DialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => productToDelete && handleDelete(productToDelete)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Product name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, price: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={editForm.quantity}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    quantity: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>{" "}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Product description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting || !editForm.name.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsPage;
