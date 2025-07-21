import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Zod schema for bill item validation
const BillItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit_price: z.number().nonnegative("Unit price must be non-negative"),
  total_price: z.number().nonnegative("Total price must be non-negative"),
  category: z.string().optional(),
});

// Zod schema for bill data validation  
const BillDataSchema = z.object({
  items: z.array(BillItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().nonnegative("Subtotal must be non-negative").optional(),
  tax_amount: z.number().nonnegative("Tax must be non-negative").optional(),
  tip_amount: z.number().nonnegative("Tip must be non-negative").optional(),
  total_amount: z.number().positive("Total must be positive"),
  restaurant_name: z.string().optional(),
  date: z.string().optional(),
});

// Type inference from Zod schema
export type BillData = z.infer<typeof BillDataSchema>;
export type BillItem = z.infer<typeof BillItemSchema>;

// Function to extract bill data from image URL using OpenAI through OpenRouter
export async function extractBillFromImage(imageUrl: string): Promise<BillData> {
  try {
    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    console.log("Starting bill extraction for image:", imageUrl);

    // Use OpenAI GPT-4o through OpenRouter with JSON mode
    const completion = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-001", // Using GPT-4o through OpenRouter
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured information from receipt and bill images.

Analyze the provided bill/receipt image and extract all items with their details.

Guidelines:
- Be precise with prices and quantities
- If you see a price that looks like it's in cents (e.g., 1250 for $12.50), convert it properly
- Group similar items if they appear separately
- Try to identify the restaurant name and date if visible
- If text is unclear, make your best reasonable interpretation
- Ensure all numeric values are realistic (no items costing $10,000)
- For each item, extract: name, quantity, unit price, and total price
- Extract subtotal, tax, tip, and final total if visible

You must respond with a valid JSON object in this exact format:
{
  "items": [
    {
      "name": "Item name",
      "quantity": 1,
      "unit_price": 10.00,
      "total_price": 10.00,
      "category": "food"
    }
  ],
  "subtotal": 50.00,
  "tax_amount": 4.00,
  "tip_amount": 10.00,
  "total_amount": 64.00,
  "restaurant_name": "Restaurant Name",
  "date": "2024-01-15"
}

Only include optional fields (subtotal, tax_amount, tip_amount, restaurant_name, date, category) if they are clearly visible on the receipt.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract all the items from this bill/receipt image. Return the response as a JSON object matching the specified format."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "auto"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1
    });

    // Extract and parse the response
    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error("No response content received from API");
    }

    console.log("Raw response content:", responseContent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseContent);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }

    // Post-process and clean up the data
    const processedData = postProcessBillData(extractedData);

    // Validate the extracted data using Zod schema
    const validatedData = validateBillData(processedData);
    
    console.log("Bill extraction completed successfully");
    console.log("Items found:", validatedData.items.length);
    console.log("Total amount:", validatedData.total_amount);
    
    return validatedData;

  } catch (error) {
    console.error("Bill extraction error:", error);
    
    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.errors);
      throw new Error(`Data validation failed: ${error.errors.map(e => e.message).join(", ")}`);
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error("Unknown error occurred during bill extraction");
  }
}

// Post-process and clean up extracted data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postProcessBillData(data: any): any {
  // Ensure items exist
  if (!data.items || !Array.isArray(data.items)) {
    data.items = [];
  }

  // Clean up item names and validate prices
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.items = data.items.map((item: any) => {
    // Clean up item name
    const name = (item.name || item.description || 'Unknown Item').toString().trim();
    
    // Ensure numeric values
    const quantity = Math.max(0, parseFloat(item.quantity) || 1);
    let unit_price = Math.max(0, parseFloat(item.unit_price || item.price) || 0);
    
    // Handle prices that might be in cents
    if (unit_price > 1000) {
      unit_price = unit_price / 100;
    }
    
    const total_price = Math.max(0, parseFloat(item.total_price) || (quantity * unit_price));

    return {
      name: name.replace(/\s+/g, ' '), // Clean up whitespace
      quantity,
      unit_price,
      total_price,
      category: item.category || 'food'
    };
  });

  // Ensure numeric totals
  data.subtotal = data.subtotal ? Math.max(0, parseFloat(data.subtotal)) : undefined;
  data.tax_amount = data.tax_amount ? Math.max(0, parseFloat(data.tax_amount)) : undefined;
  data.tip_amount = data.tip_amount ? Math.max(0, parseFloat(data.tip_amount)) : undefined;
  data.total_amount = Math.max(0, parseFloat(data.total_amount) || 0);

  // Clean up restaurant name and date
  data.restaurant_name = data.restaurant_name ? data.restaurant_name.toString().trim() : undefined;
  data.date = data.date ? data.date.toString().trim() : undefined;

  // If total_amount is 0, calculate from items
  if (data.total_amount === 0 && data.items.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsTotal = data.items.reduce((sum: number, item: any) => sum + item.total_price, 0);
    data.total_amount = itemsTotal + (data.tax_amount || 0) + (data.tip_amount || 0);
  }

  return data;
}

// Function to validate extracted bill data
export function validateBillData(data: unknown): BillData {
  try {
    // Parse and validate the data using Zod schema
    const validatedData = BillDataSchema.parse(data);
    
    // Additional business logic validation
    if (validatedData.items.length === 0) {
      throw new Error("Bill must contain at least one item");
    }
    
    // Validate that total makes sense (allowing for small rounding errors)
    const itemsTotal = validatedData.items.reduce((sum, item) => sum + item.total_price, 0);
    const calculatedTotal = itemsTotal + (validatedData.tax_amount || 0) + (validatedData.tip_amount || 0);
    const tolerance = 2.0; // Allow $2 difference for rounding
    
    if (Math.abs(calculatedTotal - validatedData.total_amount) > tolerance) {
      console.warn(`Total amount mismatch: calculated ${calculatedTotal}, extracted ${validatedData.total_amount}`);
      // Don't throw error, just warn, as OCR might have slight inaccuracies
    }
    
    return validatedData;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join("; ");
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

// Helper function to format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Helper function to calculate total items count
export function getTotalItemsCount(items: BillItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

// Helper function to get the most expensive item
export function getMostExpensiveItem(items: BillItem[]): BillItem | null {
  if (items.length === 0) return null;
  return items.reduce((max, item) => item.total_price > max.total_price ? item : max);
}



