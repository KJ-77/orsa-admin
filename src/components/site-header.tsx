"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Upload, X, Star } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ToastContainer, toast } from "react-toastify";
import { apiClient } from "@/lib/api-client";

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

export function SiteHeader() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const productSchema = z.object({
    name: z.string().min(2).max(100),
    price: z.number().min(0),
    quantity: z.number().min(1),
    description: z.string().min(1),
  });

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      quantity: 1,
      description: "",
    },
  });

  // Handle image selection
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

  // Remove image
  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));

    // Adjust primary image index if needed
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex((prev) => prev - 1);
    }
  };

  // Set primary image
  const setPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };
  // Upload image to S3
  const uploadImageToS3 = async (file: File) => {
    const response = await apiClient.post("/products/images/upload", file, {
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    return response.data;
  }; // Save image record to database
  const saveImageRecord = async (
    productId: number,
    imageData: ImageUploadResponse,
    displayOrder: number,
    isPrimary: boolean
  ) => {
    // Use snake_case format as required by the API
    const requestBody = {
      product_id: productId,
      image_url: imageData.image.url,
      image_key: imageData.image.key,
      display_order: displayOrder,
      is_primary: isPrimary,
    };

    // Validate the request body with Zod schema
    try {
      imageRecordSchema.parse(requestBody);
    } catch (validationError) {
      console.error("Request body validation failed:", validationError);
      throw new Error(`Invalid request body: ${validationError}`);
    }
    console.log("Saving image record with validated data:", requestBody);

    const response = await apiClient.post(
      "/products/images/record",
      requestBody
    );

    return response.data;
  }; // Cleanup functions for rollback
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
      // Don't throw here as this is cleanup
    }
  };
  async function onSubmit(values: z.infer<typeof productSchema>) {
    if (selectedImages.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    if (isLoading) {
      return; // Prevent double submission
    }

    setIsLoading(true);
    setUploadProgress("Creating product...");
    let createdProductId: number | null = null;
    const uploadedImages: ImageUploadResponse[] = [];

    try {
      // Step 1: Create the product
      console.log("Creating product...");
      const productResponse = await apiClient.post("/products", values);
      const productResult = productResponse.data as { productId: number };
      createdProductId = productResult.productId;
      console.log("Product created successfully:", productResult); // Step 2: Upload images to S3 one at a time
      console.log("Uploading images to S3 one by one...");
      setUploadProgress(`Uploading images (0/${selectedImages.length})`);

      for (let i = 0; i < selectedImages.length; i++) {
        try {
          setUploadProgress(
            `Uploading image ${i + 1} of ${selectedImages.length}...`
          );
          console.log(
            `Uploading image ${i + 1} of ${selectedImages.length}...`
          );
          const imageData = (await uploadImageToS3(
            selectedImages[i]
          )) as ImageUploadResponse;
          uploadedImages.push(imageData);
          console.log(`Image ${i + 1} uploaded successfully:`, imageData);
        } catch (uploadError) {
          console.error(`Failed to upload image ${i + 1}:`, uploadError);
          throw new Error(`Failed to upload image ${i + 1}: ${uploadError}`);
        }
      }

      // Step 3: Save image records to database one at a time
      console.log("Saving image records to database...");
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
          console.log(`Image ${i + 1} record saved`);
        } catch (saveError) {
          console.error(`Failed to save image ${i + 1} record:`, saveError);
          throw new Error(`Failed to save image ${i + 1} record: ${saveError}`);
        }
      } // Success - reset form and close dialog
      form.reset();
      setSelectedImages([]);
      setImagePreviews([]);
      setPrimaryImageIndex(0);
      setUploadProgress("");
      setIsDialogOpen(false);

      toast.success("Product and images added successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });

      // Refresh the page to show the new product
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error during product creation:", error);

      // Rollback: Clean up any created resources
      let rollbackSuccessful = false;
      try {
        if (createdProductId) {
          console.log(
            `Rolling back: Deleting created product with ID ${createdProductId}...`
          );
          await deleteProduct(createdProductId);
          await deleteProductImages(createdProductId);
          rollbackSuccessful = true;
          console.log("Rollback completed successfully");
        }
      } catch (rollbackError) {
        console.error("Error during rollback:", rollbackError);
        rollbackSuccessful = false;
      }

      const errorMessage = rollbackSuccessful
        ? "Failed to create product. All changes have been rolled back."
        : `Failed to create product. Warning: Product ${createdProductId} may still exist in the database and should be manually deleted.`;

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 8000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
    } finally {
      setIsLoading(false);
      setUploadProgress("");
    }
  }
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss={false}
          draggable
          pauseOnHover
          theme="dark"
        />
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Overview</h1>

        <div className="ml-auto flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Add Product</Button>
            </DialogTrigger>{" "}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Enter Product Details</DialogTitle>
                <DialogDescription>
                  This Product will automatically be added to the main Orsa page
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                        <FormDescription>
                          Available stock quantity.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
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
                              <span className="font-semibold">
                                Click to upload
                              </span>{" "}
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
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>{" "}
                    <Button type="submit" disabled={isLoading}>
                      {isLoading
                        ? uploadProgress || "Adding..."
                        : "Add Product"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
