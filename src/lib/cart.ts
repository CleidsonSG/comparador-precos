export interface CartItem {
  id: string;
  barcode: string;
  name: string;
  qty: number;
  shelfCents: number;
  storeCnpj: string;
  storeName: string;
}

const KEY = "gondola.cart.v1";

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    throw new Error("Não foi possível guardar o carrinho (armazenamento cheio ou bloqueado).");
  }
}
