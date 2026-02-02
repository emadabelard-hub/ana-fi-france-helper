import { z } from 'zod';

// Constants for input limits
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_FIELD_LENGTH = 500;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_PHONE_LENGTH = 20;
export const MAX_SIRET_LENGTH = 14;

// Allowed file types for uploads
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Sanitize string input to prevent XSS
export const sanitizeString = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
    .trim();
};

// Sanitize HTML content (more aggressive)
export const sanitizeHTML = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .trim();
};

// Profile form validation schema
export const profileSchema = z.object({
  full_name: z.string()
    .max(MAX_FIELD_LENGTH, 'Name is too long')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  address: z.string()
    .max(MAX_FIELD_LENGTH, 'Address is too long')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  phone: z.string()
    .max(MAX_PHONE_LENGTH, 'Phone number is too long')
    .regex(/^[\d\s+()-]*$/, 'Invalid phone format')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  caf_number: z.string()
    .max(20, 'CAF number is too long')
    .regex(/^[\d]*$/, 'CAF number should only contain digits')
    .optional()
    .nullable(),
  foreigner_number: z.string()
    .max(50, 'Foreigner number is too long')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  social_security: z.string()
    .max(20, 'Social security number is too long')
    .regex(/^[\d\s]*$/, 'Social security should only contain digits')
    .optional()
    .nullable(),
});

// Company profile validation schema
export const companyProfileSchema = z.object({
  company_name: z.string()
    .max(MAX_FIELD_LENGTH, 'Company name is too long')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  siret: z.string()
    .max(MAX_SIRET_LENGTH, 'SIRET must be 14 digits')
    .regex(/^[\d]*$/, 'SIRET should only contain digits')
    .optional()
    .nullable(),
  company_address: z.string()
    .max(MAX_FIELD_LENGTH, 'Company address is too long')
    .transform(sanitizeString)
    .optional()
    .nullable(),
  email: z.string()
    .max(MAX_EMAIL_LENGTH, 'Email is too long')
    .email('Invalid email format')
    .optional()
    .nullable()
    .or(z.literal('')),
  legal_status: z.enum(['auto-entrepreneur', 'societe'])
    .optional()
    .nullable(),
  header_type: z.enum(['automatic', 'full_image'])
    .optional()
    .nullable(),
  logo_url: z.string().url().optional().nullable().or(z.literal('')),
  header_image_url: z.string().url().optional().nullable().or(z.literal('')),
});

// Chat message validation schema
export const chatMessageSchema = z.object({
  message: z.string()
    .max(MAX_MESSAGE_LENGTH, 'Message is too long')
    .transform(sanitizeString),
  image: z.string().optional(),
});

// File upload validation
export const validateFileUpload = (file: File, allowedTypes: string[] = ALLOWED_DOCUMENT_TYPES): { valid: boolean; error?: string } => {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)` 
    };
  }
  
  // Check file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
  };
  
  const expectedExtensions = validExtensions[file.type] || [];
  if (!expectedExtensions.includes(extension || '')) {
    return { 
      valid: false, 
      error: 'File extension does not match file type' 
    };
  }
  
  return { valid: true };
};

// Validate and sanitize invoice/devis data
export const invoiceDataSchema = z.object({
  client_name: z.string()
    .max(MAX_FIELD_LENGTH)
    .transform(sanitizeString),
  client_address: z.string()
    .max(MAX_FIELD_LENGTH)
    .transform(sanitizeString)
    .optional(),
  items: z.array(z.object({
    description: z.string().max(MAX_FIELD_LENGTH).transform(sanitizeString),
    quantity: z.number().min(0).max(999999),
    unit_price: z.number().min(0).max(999999999),
    unit: z.string().max(20).transform(sanitizeString).optional(),
  })),
  notes: z.string()
    .max(MAX_MESSAGE_LENGTH)
    .transform(sanitizeString)
    .optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;
export type ChatMessageData = z.infer<typeof chatMessageSchema>;
export type InvoiceData = z.infer<typeof invoiceDataSchema>;
