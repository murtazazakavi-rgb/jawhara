"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
/**
 * Standardizes a phone number into canonical E.164 format.
 * Primarily handles Indian phone formats conveniently but supports international numbers.
 * E.g.,
 * "9876543210" -> "+919876543210"
 * "+91 98765-43210" -> "+919876543210"
 * "09876543210" -> "+919876543210"
 * "+1 415 555 2671" -> "+14155552671"
 */
function normalizePhoneNumber(phone) {
    if (!phone)
        return '';
    // Strip all whitespace, dashes, parentheses
    let digits = phone.replace(/[\s\-\(\)]/g, '');
    // If already starts with '+', keep it and clean other characters
    if (digits.startsWith('+')) {
        return '+' + digits.replace(/\D/g, '');
    }
    // Remove leading single zero (common in Indian domestic dials)
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    // Only keep digits
    digits = digits.replace(/\D/g, '');
    // If it is 10 digits, assume it is an Indian mobile number
    if (digits.length === 10) {
        return `+91${digits}`;
    }
    // If it starts with 91 and has 12 digits, it already has the Indian country code
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+${digits}`;
    }
    // Default fallback: prepend +
    return `+${digits}`;
}
