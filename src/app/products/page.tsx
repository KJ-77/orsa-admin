"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { apiClient } from "@/lib/api-client";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ImageIcon,
  Plus,
  Star,
  MoveUp,
  MoveDown,
  X,
} from "lucide-react";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [submitting, setSubmitting] = useState(false);

  // Image management state
  const [editingImages, setEditingImages] = useState<ProductImage[]>([]);
  const [newImageForm, setNewImageForm] = useState({
    image_url: "",
    image_key: "",
    display_order: 1,
    is_primary: false,
  });
  const [showAddImageForm, setShowAddImageForm] = useState(false); // Fetch products with images
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/products");
      const data = response.data as
        | Product[]
        | { value?: Product[]; products?: Product[] };

      // Handle different possible response structures
      let productsArray: Product[] = [];

      if (Array.isArray(data)) {
        productsArray = data;
      } else if (data.value && Array.isArray(data.value)) {
        productsArray = data.value;
      } else if (data.products && Array.isArray(data.products)) {
        productsArray = data.products;
      } else {
        productsArray = [];
      }

      // Fetch images for each product
      const productsWithImages = await Promise.all(
        productsArray.map(async (product) => {
          try {
            const imageResponse = await apiClient.get(
              `/products/${product.id}/images`
            );

            const imageData = imageResponse.data as
              | ProductImage[]
              | { images?: ProductImage[] };
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
              primaryImage: primaryImage || undefined,
            };
          } catch (imageError) {
            console.error(
              `Error fetching images for product ${product.id}:`,
              imageError
            );
            return {
              ...product,
              images: [],
              primaryImage: undefined,
            };
          }
        })
      );

      setProducts(productsWithImages);
      setLoading(false);
    } catch {
      toast.error("Failed to fetch products");
      setLoading(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (product: Product) => {
    try {
      setSubmitting(true);
      await apiClient.delete(`/products/${product.id}`);

      // Remove from local state
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      toast.success("Product deleted successfully");
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setSubmitting(false);
    }
  };
  // Update product
  const handleUpdateProduct = async () => {
    if (!productToEdit) return;
    try {
      setSubmitting(true);
      await apiClient.put(`/products/${productToEdit.id}`, {
        name: editForm.name,
        price: editForm.price,
        quantity: editForm.quantity,
        description: editForm.description,
      });

      // Update local state with new product data and images
      const primaryImage =
        editingImages.find((img) => img.is_primary)?.image_url ||
        editingImages[0]?.image_url ||
        null;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productToEdit.id
            ? {
                ...editForm,
                images: editingImages,
                primaryImage,
              }
            : p
        )
      );

      setEditDialogOpen(false);
      setProductToEdit(null);
      toast.success("Product updated successfully");
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
    setEditingImages(product.images || []);
    setShowAddImageForm(false);
    setNewImageForm({
      image_url: "",
      image_key: "",
      display_order: (product.images?.length || 0) + 1,
      is_primary: (product.images?.length || 0) === 0,
    });
    setEditDialogOpen(true);
  };
  // Open delete dialog
  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Image management functions
  const handleAddImage = async () => {
    if (
      !productToEdit ||
      !newImageForm.image_url.trim() ||
      !newImageForm.image_key.trim()
    )
      return;
    try {
      setSubmitting(true);
      const response = await apiClient.post("/products/images/record", {
        product_id: productToEdit.id,
        image_url: newImageForm.image_url,
        image_key: newImageForm.image_key,
        display_order: newImageForm.display_order,
        is_primary: newImageForm.is_primary,
      });
      const newImage = response.data as ProductImage;

      // Update editing images state
      setEditingImages((prev) => [...prev, newImage]);

      // Reset form
      setNewImageForm({
        image_url: "",
        image_key: "",
        display_order: editingImages.length + 2,
        is_primary: false,
      });
      setShowAddImageForm(false);
      toast.success("Image added successfully");
    } catch (error) {
      console.error("Error adding image:", error);
      toast.error("Failed to add image");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      setSubmitting(true);
      await apiClient.delete(`/products/images/record/${imageId}`);

      setEditingImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success("Image deleted successfully");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimaryImage = async (imageId: number) => {
    if (!productToEdit) return;
    try {
      setSubmitting(true);
      await apiClient.put(
        `/products/${productToEdit.id}/images/${imageId}/primary`
      );

      setEditingImages((prev) =>
        prev.map((img) => ({
          ...img,
          is_primary: img.id === imageId,
        }))
      );
      toast.success("Primary image updated");
    } catch (error) {
      console.error("Error setting primary image:", error);
      toast.error("Failed to update primary image");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateImageOrder = async (imageId: number, newOrder: number) => {
    try {
      setSubmitting(true);
      await apiClient.put(`/products/images/record/${imageId}`, {
        display_order: newOrder,
      });

      setEditingImages((prev) =>
        prev
          .map((img) =>
            img.id === imageId ? { ...img, display_order: newOrder } : img
          )
          .sort((a, b) => a.display_order - b.display_order)
      );
      toast.success("Image order updated");
    } catch (error) {
      console.error("Error updating image order:", error);
      toast.error("Failed to update image order");
    } finally {
      setSubmitting(false);
    }
  };

  const moveImageUp = (imageId: number) => {
    const imageIndex = editingImages.findIndex((img) => img.id === imageId);
    if (imageIndex > 0) {
      const newOrder = editingImages[imageIndex - 1].display_order;
      handleUpdateImageOrder(imageId, newOrder);
    }
  };

  const moveImageDown = (imageId: number) => {
    const imageIndex = editingImages.findIndex((img) => img.id === imageId);
    if (imageIndex < editingImages.length - 1) {
      const newOrder = editingImages[imageIndex + 1].display_order;
      handleUpdateImageOrder(imageId, newOrder);
    }
  };
  useEffect(() => {
    console.log("useEffect running, calling fetchProducts...");
    fetchProducts();
  }, []); // Empty dependency array - only run once on mount

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />{" "}
        <span className="ml-2">Loading products...</span>
      </div>
    );
  }

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
                )}{" "}
                {/* Image Count Badge */}
                {product.images && product.images.length > 1 && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    +{product.images.length - 1} more
                  </div>
                )}
              </div>{" "}
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
                  {/* Action Menu moved to header */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
              onClick={() =>
                productToDelete && handleDeleteProduct(productToDelete)
              }
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
      </Dialog>{" "}
      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information and manage images below.
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
            {/* Image Management Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Product Images</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddImageForm(!showAddImageForm)}
                  disabled={submitting}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Image
                </Button>
              </div>

              {/* Add Image Form */}
              {showAddImageForm && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input
                      id="imageUrl"
                      value={newImageForm.image_url}
                      onChange={(e) =>
                        setNewImageForm((prev) => ({
                          ...prev,
                          image_url: e.target.value,
                        }))
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imageKey">Image Key</Label>
                    <Input
                      id="imageKey"
                      value={newImageForm.image_key}
                      onChange={(e) =>
                        setNewImageForm((prev) => ({
                          ...prev,
                          image_key: e.target.value,
                        }))
                      }
                      placeholder="product-images/image123.jpg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayOrder">Display Order</Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={newImageForm.display_order}
                      onChange={(e) =>
                        setNewImageForm((prev) => ({
                          ...prev,
                          display_order: parseInt(e.target.value) || 1,
                        }))
                      }
                      placeholder="1"
                    />
                  </div>{" "}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPrimary"
                      checked={newImageForm.is_primary}
                      onCheckedChange={(checked) =>
                        setNewImageForm((prev) => ({
                          ...prev,
                          is_primary: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="isPrimary">Set as primary image</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddImage}
                      disabled={
                        submitting ||
                        !newImageForm.image_url.trim() ||
                        !newImageForm.image_key.trim()
                      }
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Image"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddImageForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing Images */}
              {editingImages.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Images</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingImages
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((image, index) => (
                        <div
                          key={image.id}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <img
                            src={image.image_url}
                            alt={`Product image ${index + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              Order: {image.display_order}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {image.image_key}
                            </p>
                            {image.is_primary && (
                              <div className="flex items-center text-xs text-yellow-600">
                                <Star className="w-3 h-3 mr-1 fill-current" />
                                Primary
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveImageUp(image.id)}
                              disabled={submitting || index === 0}
                              className="h-8 w-8 p-0"
                            >
                              <MoveUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveImageDown(image.id)}
                              disabled={
                                submitting || index === editingImages.length - 1
                              }
                              className="h-8 w-8 p-0"
                            >
                              <MoveDown className="h-4 w-4" />
                            </Button>
                            {!image.is_primary && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetPrimaryImage(image.id)}
                                disabled={submitting}
                                className="h-8 w-8 p-0"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteImage(image.id)}
                              disabled={submitting}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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
              onClick={handleUpdateProduct}
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
          </DialogFooter>{" "}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProtectedProductsPage = () => {
  return (
    <ProtectedRoute>
      <ProductsPage />
    </ProtectedRoute>
  );
};

export default ProtectedProductsPage;
