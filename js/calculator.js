// ===============================
// CALCULATOR — Shared Payment Math
// ===============================
// THE single source of truth for all payment calculations.
// Every part of the cashier page (cart summary, receipt,
// charge button, transaction record, change display) MUST
// use values returned by calculateTotals().
//
// Formula:
//   subtotal     = sum of each cart item's total
//   discountAmt  = subtotal × (discountPercent / 100)
//   taxable      = subtotal − discountAmt
//   taxAmt       = taxable × (taxRate / 100)
//   total        = taxable + taxAmt
//   change       = amountTendered − total
//
// All values rounded to 2 decimal places.
// ===============================

import { getStoreSettings } from './utils.js';

/**
 * Compute all totals from the current cart and discount percentage.
 *
 * @param {Array}  cart            — Array of { price, qty, total }
 * @param {number} discountPercent — 0–100 percentage
 * @returns {{ subtotal: number, discountAmt: number, taxable: number, taxAmt: number, total: number, taxRate: number, discountPercent: number }}
 */
export function calculateTotals(cart, discountPercent) {
  const subtotal = cart.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const discountAmt = subtotal * (parseFloat(discountPercent) || 0) / 100;
  const taxable = subtotal - discountAmt;
  const s = getStoreSettings();
  const taxRate = parseFloat(s.taxRate) || 0;
  const taxAmt = taxable * (taxRate / 100);
  const total = taxable + taxAmt;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmt: Math.round(discountAmt * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    taxAmt: Math.round(taxAmt * 100) / 100,
    total: Math.round(total * 100) / 100,
    taxRate: taxRate,
    discountPercent: parseFloat(discountPercent) || 0
  };
}

/**
 * Compute the change due.
 *
 * @param {number} amountTendered
 * @param {number} total
 * @returns {number} Change (negative if insufficient payment)
 */
export function calculateChange(amountTendered, total) {
  const tendered = parseFloat(amountTendered) || 0;
  const finalTotal = parseFloat(total) || 0;
  return Math.round((tendered - finalTotal) * 100) / 100;
}
