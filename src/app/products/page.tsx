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
  DialogTrigger,
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
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

interface ImageUploadResponse {
  message: string;
  image: {
    key: string;
    url: string;
    bucket: string;
    contentType: string;
    size: number;
    fileName: string;
  };
}

// Zod schema for image record creation
const imageRecordSchema = z.object({
  product_id: z.number().int().positive(),
  image_url: z.string().url(),
  image_key: z.string().min(1),
  display_order: z.number().int().positive(),
  is_primary: z.boolean(),
});

// Product creation schema
const productSchema = z.object({
  name: z.string().min(2).max(100),
  price: z.number().min(0),
  quantity: z.number().min(1),
  description: z.string().min(1),
});

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

  // Add Product state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Image management state
  const [editingImages, setEditingImages] = useState<ProductImage[]>([]);
  const [newImageForm, setNewImageForm] = useState({
    image_url: "",
    image_key: "",
    display_order: 1,
    is_primary: false,
  });
  const [showAddImageForm, setShowAddImageForm] = useState(false);

  // Add Product form
  const addProductForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      quantity: 1,
      description: "",
    },
  });

  // Fetch products with images
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
      });      // Update local state with new product data and images
      const primaryImage =
        editingImages.find((img) => img.is_primary)?.image_url ||
        editingImages[0]?.image_url ||
        undefined;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productToEdit.id
            ? {
                ...p,
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

  // Add Product functions
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const validFiles = files.filter((file) => validTypes.includes(file.type));

    if (validFiles.length !== files.length) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    setSelectedImages((prev) => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));

    // Adjust primary image index if needed
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex((prev) => prev - 1);
    }
  };

  const setPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };

  const uploadImageToS3 = async (file: File) => {
    const response = await apiClient.post("/products/images/upload", file, {
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    return response.data;
  };

  const saveImageRecord = async (
    productId: number,
    imageData: ImageUploadResponse,
    displayOrder: number,
    isPrimary: boolean
  ) => {
    const requestBody = {
      product_id: productId,
      image_url: imageData.image.url,
      image_key: imageData.image.key,
      display_order: displayOrder,
      is_primary: isPrimary,
    };

    try {
      imageRecordSchema.parse(requestBody);
    } catch (validationError) {
      console.error("Request body validation failed:", validationError);
      throw new Error(`Invalid request body: ${validationError}`);
    }

    const response = await apiClient.post(
      "/products/images/record",
      requestBody
    );
    return response.data;
  };

  const deleteProduct = async (productId: number) => {
    try {
      await apiClient.delete(`/products/${productId}`);
      console.log(`Product ${productId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  };

  const deleteProductImages = async (productId: number) => {
    try {
      await apiClient.delete(`/products/${productId}/images`);
      console.log(`Images for product ${productId} deletion attempted`);
    } catch (error) {
      console.error(`Error deleting images for product ${productId}:`, error);
    }
  };

  const onSubmitAddProduct = async (values: z.infer<typeof productSchema>) => {
    if (selectedImages.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setUploadProgress("Creating product...");
    let createdProductId: number | null = null;
    const uploadedImages: ImageUploadResponse[] = [];

    try {
      // Step 1: Create the product
      const productResponse = await apiClient.post("/products", values);
      const productResult = productResponse.data as { productId: number };
      createdProductId = productResult.productId;

      // Step 2: Upload images to S3 one at a time
      setUploadProgress(`Uploading images (0/${selectedImages.length})`);

      for (let i = 0; i < selectedImages.length; i++) {
        try {
          setUploadProgress(
            `Uploading image ${i + 1} of ${selectedImages.length}...`
          );
          const imageData = (await uploadImageToS3(
            selectedImages[i]
          )) as ImageUploadResponse;
          uploadedImages.push(imageData);
        } catch (uploadError) {
          throw new Error(`Failed to upload image ${i + 1}: ${uploadError}`);
        }
      }

      // Step 3: Save image records to database one at a time
      setUploadProgress("Saving image records...");
      for (let i = 0; i < uploadedImages.length; i++) {
        try {
          const isPrimary = i === primaryImageIndex;
          const displayOrder = i + 1;
          await saveImageRecord(
            createdProductId!,
            uploadedImages[i],
            displayOrder,
            isPrimary
          );
        } catch (saveError) {
          throw new Error(`Failed to save image ${i + 1} record: ${saveError}`);
        }
      }

      // Success - reset form and close dialog
      addProductForm.reset();
      setSelectedImages([]);
      setImagePreviews([]);
      setPrimaryImageIndex(0);
      setUploadProgress("");
      setIsAddDialogOpen(false);

      toast.success("Product and images added successfully!");

      // Refresh products list
      fetchProducts();
    } catch (error) {
      console.error("Error during product creation:", error);

      // Rollback: Clean up any created resources
      let rollbackSuccessful = false;
      try {
        if (createdProductId) {
          await deleteProduct(createdProductId);
          await deleteProductImages(createdProductId);
          rollbackSuccessful = true;
        }
      } catch (rollbackError) {
        console.error("Error during rollback:", rollbackError);
        rollbackSuccessful = false;
      }

      const errorMessage = rollbackSuccessful
        ? "Failed to create product. All changes have been rolled back."
        : `Failed to create product. Warning: Product ${createdProductId} may still exist in the database and should be manually deleted.`;

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setUploadProgress("");
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
      {" "}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
          </Dialog>
          <Button onClick={fetchProducts} variant="outline">
            Refresh
          </Button>
        </div>
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
            </Button>{" "}
          </DialogFooter>{" "}
        </DialogContent>
      </Dialog>
      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product with images for your inventory.
            </DialogDescription>
          </DialogHeader>
          <Form {...addProductForm}>
            <form
              onSubmit={addProductForm.handleSubmit(onSubmitAddProduct)}
              className="space-y-4"
            >
              <FormField
                control={addProductForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormDescription>
                      The display name for your product.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addProductForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Product price in your currency.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addProductForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormDescription>Available stock quantity.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addProductForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter product description"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Brief description of the product.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image Upload Section */}
              <div className="space-y-2">
                <FormLabel>Product Images *</FormLabel>
                <div className="space-y-4">
                  {/* File Input */}
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, JPEG, WebP (MAX. 5MB each)
                        </p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Image Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        Selected Images ({imagePreviews.length})
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <div
                              className={`relative rounded-lg overflow-hidden border-2 ${
                                primaryImageIndex === index
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "border-gray-200"
                              }`}
                            >
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-20 object-cover"
                              />

                              {/* Primary Badge */}
                              {primaryImageIndex === index && (
                                <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-current" />
                                  Primary
                                </div>
                              )}

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Set as Primary Button */}
                            {primaryImageIndex !== index && (
                              <button
                                type="button"
                                onClick={() => setPrimaryImage(index)}
                                className="w-full mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Set as Primary
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? uploadProgress || "Adding..." : "Add Product"}
                </Button>
              </div>
            </form>
          </Form>
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
